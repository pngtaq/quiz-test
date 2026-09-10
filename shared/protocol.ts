import type { ClientRoomState, ErrorCode, QuizSettings } from "./types";

/* ------------------------------------------------------------------ */
/* Client -> Server                                                    */
/* ------------------------------------------------------------------ */

/**
 * Room creation and joining happen over HTTP (`POST /api/rooms` and
 * `POST /api/rooms/:code/join`) because a Durable Object is addressed by room
 * code, so the room must exist before a socket can be routed to it. Those
 * calls return a secret `sessionToken`, which the socket presents in
 * JOIN_ROOM. Reconnects send the same token, so the player keeps their
 * identity and is never duplicated.
 */
export type ClientMessage =
  | { type: "JOIN_ROOM"; sessionToken: string }
  | { type: "UPDATE_SETTINGS"; settings: QuizSettings }
  | { type: "START_QUIZ" }
  /**
   * `questionIndex` is only used to reject stale answers (it must equal the
   * server's current index); the server never trusts it to pick a question.
   */
  | { type: "SUBMIT_ANSWER"; questionIndex: number; choiceIndex: number }
  | { type: "NEXT_QUESTION" }
  | { type: "PLAY_AGAIN" }
  | { type: "LEAVE_ROOM" }
  | { type: "END_ROOM" };

export type ClientMessageType = ClientMessage["type"];

/* ------------------------------------------------------------------ */
/* Server -> Client                                                    */
/* ------------------------------------------------------------------ */

/** Something that happened in a room. Every event ships with a fresh snapshot. */
export type RoomEvent =
  | { type: "ROOM_STATE" }
  | { type: "PLAYER_JOINED"; playerId: string; nickname: string }
  | { type: "PLAYER_LEFT"; playerId: string; nickname: string }
  | { type: "LEADER_CHANGED"; playerId: string; nickname: string }
  | { type: "SETTINGS_UPDATED" }
  | { type: "QUIZ_STARTED" }
  | { type: "QUESTION_STARTED"; questionIndex: number }
  | { type: "ANSWER_SUBMITTED"; playerId: string }
  /** Also the leaderboard update: the snapshot carries the new scores. */
  | { type: "ANSWER_REVEALED"; questionIndex: number }
  | { type: "QUIZ_FINISHED" }
  | { type: "QUIZ_RESET" };

export type RoomEventType = RoomEvent["type"];

export type RoomEndReason = "ENDED_BY_LEADER" | "EXPIRED";

/**
 * State-bearing messages always include the full personalized snapshot, so the
 * client never has to re-derive server state from a sequence of deltas.
 */
export type ServerMessage =
  | (RoomEvent & { room: ClientRoomState; serverTime: number })
  | { type: "ERROR"; code: ErrorCode; message: string }
  | { type: "ROOM_ENDED"; reason: RoomEndReason; message: string }
  | { type: "PONG" };

/**
 * Heartbeat frames. The Durable Object answers these via
 * `setWebSocketAutoResponse`, so they never wake a hibernating room.
 * They must match byte-for-byte.
 */
export const PING_MESSAGE = '{"type":"PING"}';
export const PONG_MESSAGE = '{"type":"PONG"}';

/* ------------------------------------------------------------------ */
/* WebSocket close codes (4000-4999 are application-defined)           */
/* ------------------------------------------------------------------ */

export const CloseCode = {
  NORMAL: 1000,
  ROOM_ENDED: 4000,
  LEFT_ROOM: 4001,
  INVALID_SESSION: 4401,
  ORIGIN_NOT_ALLOWED: 4403,
  ROOM_NOT_FOUND: 4404,
  SESSION_REPLACED: 4409,
  TOO_MANY_CONNECTIONS: 4429,
} as const;

export type CloseCodeValue = (typeof CloseCode)[keyof typeof CloseCode];
