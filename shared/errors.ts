import type { ErrorCode } from "./types";

/** User-facing messages. Raw server errors are never shown to players. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_ROOM_CODE: "That room code doesn't look right. Codes are 5 letters or numbers.",
  ROOM_NOT_FOUND: "Room not found. Check the code and try again.",
  ROOM_FULL: "This room is full.",
  INVALID_NICKNAME: `Please choose a nickname between 1 and 20 characters.`,
  NICKNAME_TAKEN: "This nickname is already taken in this room.",
  QUIZ_ALREADY_STARTED: "The quiz has already started and late joining is turned off.",
  INVALID_SETTINGS: "Some quiz settings are invalid. Please review them.",
  NOT_LEADER: "Only the leader can do that.",
  INVALID_STATE: "That action isn't available right now.",
  INVALID_ANSWER: "Invalid answer.",
  ALREADY_ANSWERED: "You've already answered this question.",
  QUESTION_CLOSED: "Time's up. This question is closed.",
  NOT_ENOUGH_PLAYERS: "At least one connected player is needed to start.",
  INVALID_SESSION: "Your session for this room has expired. Please join again.",
  NOT_JOINED: "You need to join the room first.",
  INVALID_MESSAGE: "Something went wrong sending that. Please try again.",
  ORIGIN_NOT_ALLOWED: "This site isn't allowed to connect to the quiz server.",
  TOO_MANY_CONNECTIONS: "Too many connections to this room. Please try again later.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
};

export class RoomError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string = ERROR_MESSAGES[code]) {
    super(message);
    this.name = "RoomError";
    this.code = code;
  }
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}
