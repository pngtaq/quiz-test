/**
 * Server-only state. These shapes include secrets (session tokens) and the
 * answer key, so they are never sent to clients directly: see
 * `toClientState` in engine.ts for the public projection.
 */
import type {
  Category,
  Difficulty,
  QuizSettings,
  RoomStatus,
} from "../../../shared/types";

/** Raw dataset entry. The shape an external question API would also map to. */
export interface QuestionSource {
  id: string;
  category: Category;
  difficulty: Difficulty;
  question: string;
  answers: string[];
  /** Index into `answers`. */
  correctAnswer: number;
}

/** A question prepared for one quiz run (choices possibly shuffled). */
export interface RoomQuestion {
  id: string;
  text: string;
  choices: string[];
  correctIndex: number;
  category: Category;
  difficulty: Difficulty;
}

export interface PlayerRecord {
  id: string;
  nickname: string;
  /** Secret used to (re)attach a WebSocket to this player. */
  sessionToken: string;
  score: number;
  correctAnswers: number;
  joinedAt: number;
  connected: boolean;
  /** False until the first WebSocket connects; hidden from player lists until then. */
  hasConnected: boolean;
  disconnectedAt: number | null;
}

export interface AnswerRecord {
  choiceIndex: number;
  correct: boolean;
  /** Points earned; applied to the player's score only at reveal time. */
  pointsAwarded: number;
  elapsedMs: number;
}

export interface RoomState {
  version: 1;
  roomCode: string;
  createdAt: number;
  lastActivityAt: number;
  status: RoomStatus;
  leaderId: string;
  settings: QuizSettings;
  players: Record<string, PlayerRecord>;
  questions: RoomQuestion[];
  /** -1 while in the lobby. */
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  /** Deadline of the current timed phase (QUESTION or ANSWER_REVEAL). */
  phaseEndsAt: number | null;
  /** Answers for the current question, keyed by player id. */
  answers: Record<string, AnswerRecord>;
}

/** Injected sources of randomness so the engine stays pure and testable. */
export interface EngineDeps {
  random: () => number;
  generateId: () => string;
  generateToken: () => string;
}
