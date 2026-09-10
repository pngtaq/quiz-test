/**
 * Domain types shared by the Next.js client and the realtime Worker.
 * Nothing in this file may contain answer keys or secrets: it describes
 * what the server is willing to expose to clients.
 */

export type RoomStatus =
  | "LOBBY"
  | "QUESTION"
  | "ANSWER_REVEAL"
  | "RESULTS"
  | "ENDED";

export type Difficulty = "easy" | "medium" | "hard";
export type DifficultySetting = Difficulty | "mixed";

export type Category =
  | "general"
  | "science"
  | "technology"
  | "history"
  | "geography"
  | "sports"
  | "entertainment"
  | "programming";
export type CategorySetting = Category | "random";

export interface QuizSettings {
  maxPlayers: number;
  questionCount: number;
  difficulty: DifficultySetting;
  category: CategorySetting;
  /** Seconds each question stays open. */
  timePerQuestion: number;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  allowLateJoin: boolean;
  showCorrectAnswer: boolean;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  isLeader: boolean;
  score: number;
  correctAnswers: number;
  /** Whether the player has answered the current question. */
  answered: boolean;
  connected: boolean;
  joinedAt: number;
}

/** A question as sent to players: no correct answer included. */
export interface PublicQuestion {
  id: string;
  text: string;
  choices: string[];
  category: Category;
  difficulty: Difficulty;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  /** 0-100, rounded. */
  accuracy: number;
  connected: boolean;
}

export interface MyAnswerResult {
  choiceIndex: number | null;
  correct: boolean;
  pointsAwarded: number;
}

/** Only populated during ANSWER_REVEAL. */
export interface RevealInfo {
  /** null when the room hides correct answers between questions. */
  correctIndex: number | null;
  /** How many players picked each choice; null when answers are hidden. */
  choiceCounts: number[] | null;
  /** The viewer's own outcome; null when answers are hidden. */
  myResult: MyAnswerResult | null;
}

/** Personalized, authoritative snapshot of a room for one connected player. */
export interface ClientRoomState {
  roomCode: string;
  status: RoomStatus;
  settings: QuizSettings;
  leaderId: string;
  players: PublicPlayer[];
  me: { playerId: string; isLeader: boolean };
  /** 0-based index of the current question, -1 before the quiz starts. */
  questionIndex: number;
  totalQuestions: number;
  question: PublicQuestion | null;
  /** Server epoch ms. */
  questionStartedAt: number | null;
  /** Server epoch ms at which the current timed phase ends. */
  phaseEndsAt: number | null;
  /** Choice the viewer submitted for the current question. */
  myAnswer: number | null;
  answeredCount: number;
  reveal: RevealInfo | null;
  leaderboard: LeaderboardEntry[];
}

export type ErrorCode =
  | "INVALID_ROOM_CODE"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "INVALID_NICKNAME"
  | "NICKNAME_TAKEN"
  | "QUIZ_ALREADY_STARTED"
  | "INVALID_SETTINGS"
  | "NOT_LEADER"
  | "INVALID_STATE"
  | "INVALID_ANSWER"
  | "ALREADY_ANSWERED"
  | "QUESTION_CLOSED"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_SESSION"
  | "NOT_JOINED"
  | "INVALID_MESSAGE"
  | "ORIGIN_NOT_ALLOWED"
  | "TOO_MANY_CONNECTIONS"
  | "INTERNAL_ERROR";

/** Response body of the create/join HTTP endpoints. */
export interface JoinResponse {
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string };
}
