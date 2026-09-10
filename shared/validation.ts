import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  MAX_MESSAGE_BYTES,
  MAX_PLAYERS_OPTIONS,
  NICKNAME_MAX_LENGTH,
  QUESTION_COUNT_OPTIONS,
  ROOM_CODE_PATTERN,
  TIME_PER_QUESTION_OPTIONS,
} from "./constants";
import type { ClientMessage } from "./protocol";
import type { CategorySetting, DifficultySetting, QuizSettings } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Uppercases and strips whitespace/dashes so "ab7 kq" becomes "AB7KQ". */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidRoomCode(code: unknown): code is string {
  return typeof code === "string" && ROOM_CODE_PATTERN.test(code);
}

/**
 * Returns a cleaned nickname, or null if invalid. Control characters are
 * removed, whitespace collapsed, and length counted in code points.
 */
export function normalizeNickname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const length = [...cleaned].length;
  if (length < 1 || length > NICKNAME_MAX_LENGTH) return null;
  return cleaned;
}

/** Case-insensitive key used to detect duplicate nicknames. */
export function nicknameKey(nickname: string): string {
  return nickname.normalize("NFKC").toLocaleLowerCase("en-US");
}

function oneOf<T>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T);
}

/** Strictly validates quiz settings. Unknown or out-of-range values fail. */
export function parseSettings(input: unknown): QuizSettings | null {
  if (!isRecord(input)) return null;
  const {
    maxPlayers,
    questionCount,
    difficulty,
    category,
    timePerQuestion,
    randomizeQuestions,
    randomizeAnswers,
    allowLateJoin,
    showCorrectAnswer,
  } = input;

  if (!oneOf<number>(MAX_PLAYERS_OPTIONS, maxPlayers)) return null;
  if (!oneOf<number>(QUESTION_COUNT_OPTIONS, questionCount)) return null;
  if (!oneOf<DifficultySetting>(DIFFICULTY_OPTIONS, difficulty)) return null;
  if (!oneOf<CategorySetting>(CATEGORY_OPTIONS, category)) return null;
  if (!oneOf<number>(TIME_PER_QUESTION_OPTIONS, timePerQuestion)) return null;
  if (
    typeof randomizeQuestions !== "boolean" ||
    typeof randomizeAnswers !== "boolean" ||
    typeof allowLateJoin !== "boolean" ||
    typeof showCorrectAnswer !== "boolean"
  ) {
    return null;
  }

  return {
    maxPlayers,
    questionCount,
    difficulty,
    category,
    timePerQuestion,
    randomizeQuestions,
    randomizeAnswers,
    allowLateJoin,
    showCorrectAnswer,
  };
}

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function isNonNegativeInt(value: unknown, max: number): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
  );
}

/** Parses and validates a raw WebSocket frame. Returns null for anything malformed. */
export function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | null {
  if (typeof raw !== "string") return null;
  if (raw.length > MAX_MESSAGE_BYTES) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.type !== "string") return null;

  switch (data.type) {
    case "JOIN_ROOM":
      return typeof data.sessionToken === "string" &&
        SESSION_TOKEN_PATTERN.test(data.sessionToken)
        ? { type: "JOIN_ROOM", sessionToken: data.sessionToken }
        : null;
    case "UPDATE_SETTINGS": {
      const settings = parseSettings(data.settings);
      return settings ? { type: "UPDATE_SETTINGS", settings } : null;
    }
    case "SUBMIT_ANSWER":
      return isNonNegativeInt(data.questionIndex, 1000) &&
        isNonNegativeInt(data.choiceIndex, 16)
        ? {
            type: "SUBMIT_ANSWER",
            questionIndex: data.questionIndex,
            choiceIndex: data.choiceIndex,
          }
        : null;
    case "START_QUIZ":
    case "NEXT_QUESTION":
    case "PLAY_AGAIN":
    case "LEAVE_ROOM":
    case "END_ROOM":
      return { type: data.type };
    default:
      return null;
  }
}
