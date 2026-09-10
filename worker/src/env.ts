import type { QuizRoom } from "./quiz-room";

export interface Env {
  QUIZ_ROOM: DurableObjectNamespace<QuizRoom>;
  /** Comma-separated list of allowed browser origins, or "*". */
  ALLOWED_ORIGINS: string;
}
