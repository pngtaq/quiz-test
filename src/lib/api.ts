import { ERROR_MESSAGES, isErrorCode } from "@shared/errors";
import type { ErrorCode, JoinResponse, QuizSettings } from "@shared/types";
import { isRecord } from "@shared/validation";
import { apiUrl } from "./config";

export type ApiErrorCode = ErrorCode | "NETWORK_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

const NETWORK_ERROR_MESSAGE =
  "Unable to reach the quiz server. Check your connection and try again.";

function isJoinResponse(value: unknown): value is JoinResponse {
  return (
    isRecord(value) &&
    typeof value.roomCode === "string" &&
    typeof value.playerId === "string" &&
    typeof value.sessionToken === "string"
  );
}

async function post(path: string, body: unknown): Promise<JoinResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (e.g. a proxy error page); handled below.
  }

  if (!response.ok) {
    // Only known codes are surfaced, always with our own wording.
    const code =
      isRecord(data) && isRecord(data.error) && isErrorCode(data.error.code)
        ? data.error.code
        : "INTERNAL_ERROR";
    throw new ApiError(code, ERROR_MESSAGES[code]);
  }
  if (!isJoinResponse(data)) {
    throw new ApiError("INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
  }
  return data;
}

export function createRoom(nickname: string, settings: QuizSettings): Promise<JoinResponse> {
  return post("/api/rooms", { nickname, settings });
}

export function joinRoom(roomCode: string, nickname: string): Promise<JoinResponse> {
  return post(`/api/rooms/${encodeURIComponent(roomCode)}/join`, { nickname });
}
