import { DurableObject } from "cloudflare:workers";
import { ERROR_MESSAGES, RoomError } from "../../shared/errors";
import {
  CloseCode,
  PING_MESSAGE,
  PONG_MESSAGE,
  type ClientMessage,
  type RoomEndReason,
  type RoomEvent,
  type ServerMessage,
} from "../../shared/protocol";
import type { ErrorCode, JoinResponse, QuizSettings } from "../../shared/types";
import { parseClientMessage } from "../../shared/validation";
import type { Env } from "./env";
import {
  addPlayer,
  assertCanStartQuiz,
  connectPlayer,
  createRoom,
  disconnectPlayer,
  endRoom,
  nextAlarmTime,
  nextQuestion,
  playAgain,
  removePlayer,
  startQuiz,
  submitAnswer,
  tick,
  toClientState,
  updateSettings,
} from "./game/engine";
import { LocalQuestionProvider, type QuestionProvider } from "./game/questions";
import type { EngineDeps, RoomState } from "./game/types";
import { QUESTION_BANK } from "./data/questions";
import { generateId, generateToken, secureRandom } from "./lib/random";

const STORAGE_KEY = "room";
const WS_OPEN = 1;

interface SocketAttachment {
  playerId: string | null;
}

export type CreateRoomResult =
  | { ok: true; data: JoinResponse }
  | { ok: false; code: ErrorCode | "ROOM_CODE_TAKEN" };

export type JoinRoomResult = { ok: true; data: JoinResponse } | { ok: false; code: ErrorCode };

const deps: EngineDeps = { random: secureRandom, generateId, generateToken };

function toErrorCode(error: unknown): ErrorCode {
  return error instanceof RoomError ? error.code : "INTERNAL_ERROR";
}

/**
 * One instance per room code. Holds the authoritative room state, accepts
 * player WebSockets (Hibernation API, so idle rooms cost nothing), and uses a
 * single storage alarm for question timers, reveal delays, lobby cleanup,
 * leader hand-off and room expiry.
 */
export class QuizRoom extends DurableObject<Env> {
  private room: RoomState | null = null;
  private readonly questionProvider: QuestionProvider = new LocalQuestionProvider(
    QUESTION_BANK,
    secureRandom,
  );

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Heartbeats are answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_MESSAGE, PONG_MESSAGE));
    void ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>(STORAGE_KEY)) ?? null;
    });
  }

  /* ---------------------------- RPC (HTTP API) ---------------------------- */

  async createRoom(input: {
    roomCode: string;
    nickname: string;
    settings: QuizSettings;
  }): Promise<CreateRoomResult> {
    if (this.room) return { ok: false, code: "ROOM_CODE_TAKEN" };
    try {
      const { state, leader } = createRoom({ ...input, now: Date.now(), deps });
      this.room = state;
      await this.commit([]);
      return {
        ok: true,
        data: { roomCode: state.roomCode, playerId: leader.id, sessionToken: leader.sessionToken },
      };
    } catch (error) {
      return { ok: false, code: toErrorCode(error) };
    }
  }

  async joinRoom(nickname: string): Promise<JoinRoomResult> {
    const room = this.room;
    if (!room) return { ok: false, code: "ROOM_NOT_FOUND" };
    try {
      const { player, events } = addPlayer(room, nickname, Date.now(), deps);
      await this.commit(events);
      return {
        ok: true,
        data: { roomCode: room.roomCode, playerId: player.id, sessionToken: player.sessionToken },
      };
    } catch (error) {
      return { ok: false, code: toErrorCode(error) };
    }
  }

  /* ------------------------------ WebSockets ------------------------------ */

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    this.setPlayerId(server, null);

    const room = this.room;
    if (!room) {
      this.sendError(server, "ROOM_NOT_FOUND");
      this.closeSocket(server, CloseCode.ROOM_NOT_FOUND, "Room not found");
    } else if (this.ctx.getWebSockets().length > room.settings.maxPlayers * 2 + 10) {
      this.sendError(server, "TOO_MANY_CONNECTIONS");
      this.closeSocket(server, CloseCode.TOO_MANY_CONNECTIONS, "Too many connections");
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = this.room;
    if (!room) {
      this.closeSocket(ws, CloseCode.ROOM_NOT_FOUND, "Room not found");
      return;
    }

    const message = parseClientMessage(raw);
    if (!message) {
      this.sendError(ws, "INVALID_MESSAGE");
      return;
    }

    try {
      if (message.type === "JOIN_ROOM") {
        await this.handleJoin(ws, room, message.sessionToken);
        return;
      }
      const playerId = this.getPlayerId(ws);
      if (!playerId) throw new RoomError("NOT_JOINED");
      if (!room.players[playerId]) throw new RoomError("INVALID_SESSION");
      await this.handleAction(ws, room, playerId, message);
    } catch (error) {
      const code = toErrorCode(error);
      if (code === "INTERNAL_ERROR") console.error("QuizRoom: message failed", error);
      this.sendError(ws, code, error instanceof RoomError ? error.message : undefined);
      if (code === "INVALID_SESSION") {
        this.closeSocket(ws, CloseCode.INVALID_SESSION, "Invalid session");
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.closeSocket(ws, CloseCode.NORMAL, "Connection closed");
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  /* -------------------------------- Alarms -------------------------------- */

  async alarm(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const { events, expired } = tick(room, Date.now());
    if (expired) {
      await this.destroy("EXPIRED");
      return;
    }
    await this.commit(events);
  }

  /* ------------------------------- Handlers ------------------------------- */

  private async handleJoin(ws: WebSocket, room: RoomState, sessionToken: string): Promise<void> {
    const { player, events } = connectPlayer(room, sessionToken, Date.now());
    const current = this.getPlayerId(ws);
    if (current && current !== player.id) throw new RoomError("INVALID_STATE");

    // One live socket per player: a newer tab/reconnect replaces older sockets.
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && this.getPlayerId(other) === player.id) {
        this.setPlayerId(other, null);
        this.closeSocket(other, CloseCode.SESSION_REPLACED, "Session opened elsewhere");
      }
    }
    this.setPlayerId(ws, player.id);
    await this.commit(events);
  }

  private async handleAction(
    ws: WebSocket,
    room: RoomState,
    playerId: string,
    message: Exclude<ClientMessage, { type: "JOIN_ROOM" }>,
  ): Promise<void> {
    const now = Date.now();
    switch (message.type) {
      case "UPDATE_SETTINGS":
        return this.commit(updateSettings(room, playerId, message.settings, now));
      case "START_QUIZ": {
        assertCanStartQuiz(room, playerId);
        const questions = await this.questionProvider.getQuestions(room.settings);
        // startQuiz re-validates, in case state changed while questions loaded.
        return this.commit(startQuiz(room, playerId, questions, Date.now()));
      }
      case "SUBMIT_ANSWER":
        return this.commit(
          submitAnswer(room, playerId, message.questionIndex, message.choiceIndex, now),
        );
      case "NEXT_QUESTION":
        return this.commit(nextQuestion(room, playerId, now));
      case "PLAY_AGAIN":
        return this.commit(playAgain(room, playerId, now));
      case "LEAVE_ROOM": {
        const events = removePlayer(room, playerId, now);
        this.setPlayerId(ws, null);
        this.closeSocket(ws, CloseCode.LEFT_ROOM, "Left room");
        return this.commit(events);
      }
      case "END_ROOM":
        endRoom(room, playerId, now);
        return this.destroy("ENDED_BY_LEADER");
    }
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const room = this.room;
    const playerId = this.getPlayerId(ws);
    this.setPlayerId(ws, null);
    if (!room || !playerId || !room.players[playerId]) return;

    const stillConnected = this.ctx
      .getWebSockets()
      .some((o) => o !== ws && o.readyState === WS_OPEN && this.getPlayerId(o) === playerId);
    if (stillConnected) return;

    await this.commit(disconnectPlayer(room, playerId, Date.now()));
  }

  /* ------------------------------- Plumbing ------------------------------- */

  /** Persists state, re-arms the alarm, then broadcasts events. */
  private async commit(events: RoomEvent[]): Promise<void> {
    const room = this.room;
    if (!room) return;
    await this.ctx.storage.put(STORAGE_KEY, room);
    await this.ctx.storage.setAlarm(nextAlarmTime(room, Date.now()));
    for (const event of events) this.broadcast(room, event);
  }

  private broadcast(room: RoomState, event: RoomEvent): void {
    const serverTime = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const playerId = this.getPlayerId(ws);
      if (!playerId || !room.players[playerId]) continue;
      this.send(ws, { ...event, room: toClientState(room, playerId), serverTime });
    }
  }

  private async destroy(reason: RoomEndReason): Promise<void> {
    const message =
      reason === "EXPIRED"
        ? "This room expired due to inactivity."
        : "The leader has ended this room.";
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, { type: "ROOM_ENDED", reason, message });
      this.setPlayerId(ws, null);
      this.closeSocket(ws, CloseCode.ROOM_ENDED, "Room ended");
    }
    this.room = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  private getPlayerId(ws: WebSocket): string | null {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    return attachment?.playerId ?? null;
  }

  private setPlayerId(ws: WebSocket, playerId: string | null): void {
    ws.serializeAttachment({ playerId } satisfies SocketAttachment);
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Socket already closing; the close handler will clean up.
    }
  }

  private sendError(ws: WebSocket, code: ErrorCode, message?: string): void {
    this.send(ws, { type: "ERROR", code, message: message ?? ERROR_MESSAGES[code] });
  }

  private closeSocket(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }
}
