/**
 * Realtime Worker entry point.
 *
 *   POST /api/rooms              create a room (returns leader credentials)
 *   POST /api/rooms/:code/join   reserve a seat (returns player credentials)
 *   GET  /api/rooms/:code/ws     WebSocket upgrade -> QuizRoom Durable Object
 *   GET  /health                 liveness check
 */
import { MAX_HTTP_BODY_BYTES } from "../../shared/constants";
import { ERROR_MESSAGES } from "../../shared/errors";
import { CloseCode, type CloseCodeValue, type ServerMessage } from "../../shared/protocol";
import type { ApiErrorBody, ErrorCode } from "../../shared/types";
import {
  isRecord,
  isValidRoomCode,
  normalizeNickname,
  normalizeRoomCode,
  parseSettings,
} from "../../shared/validation";
import type { Env } from "./env";
import { generateRoomCode } from "./lib/random";

export { QuizRoom } from "./quiz-room";

const ROOM_ROUTE = /^\/api\/rooms\/([A-Za-z0-9-]{1,16})\/(join|ws)$/;
const MAX_CREATE_ATTEMPTS = 5;

const HTTP_STATUS: Partial<Record<ErrorCode, number>> = {
  INVALID_ROOM_CODE: 400,
  INVALID_NICKNAME: 400,
  INVALID_SETTINGS: 400,
  INVALID_MESSAGE: 400,
  ORIGIN_NOT_ALLOWED: 403,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  NICKNAME_TAKEN: 409,
  QUIZ_ALREADY_STARTED: 409,
  INTERNAL_ERROR: 500,
};

type Headers = Record<string, string>;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const originAllowed = isOriginAllowed(origin, env.ALLOWED_ORIGINS);
    const cors = corsHeaders(origin, originAllowed);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: originAllowed ? 204 : 403, headers: cors });
      }

      if (url.pathname === "/" || url.pathname === "/health") {
        return json({ ok: true, service: "quiz-together-realtime" }, 200, cors);
      }

      if (url.pathname === "/api/rooms") {
        if (request.method !== "POST") return methodNotAllowed(cors);
        if (!originAllowed) return apiError("ORIGIN_NOT_ALLOWED", cors);
        return await handleCreateRoom(request, env, cors);
      }

      const match = ROOM_ROUTE.exec(url.pathname);
      if (match) {
        const roomCode = normalizeRoomCode(match[1] ?? "");
        if (match[2] === "ws") return await handleWebSocket(request, env, roomCode, originAllowed);
        if (request.method !== "POST") return methodNotAllowed(cors);
        if (!originAllowed) return apiError("ORIGIN_NOT_ALLOWED", cors);
        return await handleJoinRoom(request, env, roomCode, cors);
      }

      return new Response("Not found", { status: 404, headers: cors });
    } catch (error) {
      console.error("Worker: unhandled error", error);
      return apiError("INTERNAL_ERROR", cors);
    }
  },
} satisfies ExportedHandler<Env>;

async function handleCreateRoom(request: Request, env: Env, cors: Headers): Promise<Response> {
  const body = await readJsonBody(request);
  if (!isRecord(body)) return apiError("INVALID_MESSAGE", cors);
  const nickname = normalizeNickname(body.nickname);
  if (!nickname) return apiError("INVALID_NICKNAME", cors);
  const settings = parseSettings(body.settings);
  if (!settings) return apiError("INVALID_SETTINGS", cors);

  // Codes are random; on the rare collision with a live room, try another.
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const roomCode = generateRoomCode();
    const stub = env.QUIZ_ROOM.get(env.QUIZ_ROOM.idFromName(roomCode));
    const result = await stub.createRoom({ roomCode, nickname, settings });
    if (result.ok) return json(result.data, 201, cors);
    if (result.code !== "ROOM_CODE_TAKEN") return apiError(result.code, cors);
  }
  return apiError("INTERNAL_ERROR", cors);
}

async function handleJoinRoom(
  request: Request,
  env: Env,
  roomCode: string,
  cors: Headers,
): Promise<Response> {
  if (!isValidRoomCode(roomCode)) return apiError("INVALID_ROOM_CODE", cors);
  const body = await readJsonBody(request);
  if (!isRecord(body)) return apiError("INVALID_MESSAGE", cors);
  const nickname = normalizeNickname(body.nickname);
  if (!nickname) return apiError("INVALID_NICKNAME", cors);

  const stub = env.QUIZ_ROOM.get(env.QUIZ_ROOM.idFromName(roomCode));
  const result = await stub.joinRoom(nickname);
  return result.ok ? json(result.data, 200, cors) : apiError(result.code, cors);
}

async function handleWebSocket(
  request: Request,
  env: Env,
  roomCode: string,
  originAllowed: boolean,
): Promise<Response> {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }
  if (!originAllowed) return rejectWebSocket("ORIGIN_NOT_ALLOWED", CloseCode.ORIGIN_NOT_ALLOWED);
  if (!isValidRoomCode(roomCode)) return rejectWebSocket("INVALID_ROOM_CODE", CloseCode.ROOM_NOT_FOUND);

  const stub = env.QUIZ_ROOM.get(env.QUIZ_ROOM.idFromName(roomCode));
  return stub.fetch(request);
}

/**
 * Browsers can't read HTTP status codes of failed WebSocket handshakes, so we
 * complete the handshake and immediately close with an application code the
 * client understands (and won't retry).
 */
function rejectWebSocket(code: ErrorCode, closeCode: CloseCodeValue): Response {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
  server.accept();
  const message: ServerMessage = { type: "ERROR", code, message: ERROR_MESSAGES[code] };
  server.send(JSON.stringify(message));
  server.close(closeCode, code);
  return new Response(null, { status: 101, webSocket: client });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_HTTP_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_HTTP_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isOriginAllowed(origin: string | null, allowList: string | undefined): boolean {
  // Non-browser clients don't send Origin; session tokens still gate access.
  if (!origin) return true;
  const allowed = (allowList ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return allowed.includes("*") || allowed.includes(origin);
}

function corsHeaders(origin: string | null, allowed: boolean): Headers {
  if (!origin || !allowed) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, headers: Headers): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function apiError(code: ErrorCode, headers: Headers): Response {
  const body: ApiErrorBody = { error: { code, message: ERROR_MESSAGES[code] } };
  return json(body, HTTP_STATUS[code] ?? 400, headers);
}

function methodNotAllowed(headers: Headers): Response {
  return new Response("Method not allowed", { status: 405, headers });
}
