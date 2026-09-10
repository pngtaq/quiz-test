import type {
  Category,
  CategorySetting,
  Difficulty,
  DifficultySetting,
  QuizSettings,
} from "./types";

/* Room codes: no 0/O, 1/I/L to avoid confusion when read aloud. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

export const NICKNAME_MAX_LENGTH = 20;

export const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8, 10, 12, 16, 20, 30, 50] as const;
export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;
export const TIME_PER_QUESTION_OPTIONS = [10, 15, 20, 30] as const;

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];
export const DIFFICULTY_OPTIONS: readonly DifficultySetting[] = [
  "easy",
  "medium",
  "hard",
  "mixed",
];

export const CATEGORIES: readonly Category[] = [
  "general",
  "science",
  "technology",
  "history",
  "geography",
  "sports",
  "entertainment",
  "programming",
];
export const CATEGORY_OPTIONS: readonly CategorySetting[] = [
  ...CATEGORIES,
  "random",
];

export const CATEGORY_LABELS: Record<CategorySetting, string> = {
  general: "General Knowledge",
  science: "Science",
  technology: "Technology",
  history: "History",
  geography: "Geography",
  sports: "Sports",
  entertainment: "Entertainment",
  programming: "Programming",
  random: "Random (all categories)",
};

export const DIFFICULTY_LABELS: Record<DifficultySetting, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  mixed: "Mixed",
};

export const DEFAULT_SETTINGS: QuizSettings = {
  maxPlayers: 10,
  questionCount: 10,
  difficulty: "mixed",
  category: "random",
  timePerQuestion: 20,
  randomizeQuestions: true,
  randomizeAnswers: true,
  allowLateJoin: false,
  showCorrectAnswer: true,
};

/* Scoring */
export const BASE_POINTS = 1000;
export const MAX_SPEED_BONUS = 500;

/* Timing (all server-side) */
/** Network latency allowance for answers that arrive right at the deadline. */
export const ANSWER_GRACE_MS = 500;
/** Pause after a question when the correct answer is shown. */
export const REVEAL_DURATION_MS = 7_000;
/** Shorter pause when correct answers are hidden (leaderboard only). */
export const REVEAL_DURATION_HIDDEN_MS = 4_000;
/** Lobby players who disconnect are removed if they don't return in time. */
export const LOBBY_DISCONNECT_GRACE_MS = 20_000;
/** A disconnected leader hands leadership to a connected player after this. */
export const LEADER_HANDOFF_GRACE_MS = 30_000;
/** Rooms with nobody connected are deleted after this. */
export const EMPTY_ROOM_TTL_MS = 10 * 60_000;
/** Rooms with no activity at all are deleted after this. */
export const IDLE_ROOM_TTL_MS = 60 * 60_000;

/* Transport limits */
export const MAX_MESSAGE_BYTES = 4_096;
export const MAX_HTTP_BODY_BYTES = 8_192;
