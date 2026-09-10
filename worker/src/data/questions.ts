/**
 * Local question bank for the MVP. It is bundled only into the realtime
 * Worker, so answer keys never ship to browsers. To use an external source,
 * implement `QuestionProvider` (see game/questions.ts) and map results to
 * `QuestionSource`.
 */
import type { QuestionSource } from "../game/types";
import { entertainmentQuestions } from "./questions/entertainment";
import { generalQuestions } from "./questions/general";
import { geographyQuestions } from "./questions/geography";
import { historyQuestions } from "./questions/history";
import { programmingQuestions } from "./questions/programming";
import { scienceQuestions } from "./questions/science";
import { sportsQuestions } from "./questions/sports";
import { technologyQuestions } from "./questions/technology";

export const QUESTION_BANK: readonly QuestionSource[] = [
  ...generalQuestions,
  ...scienceQuestions,
  ...technologyQuestions,
  ...historyQuestions,
  ...geographyQuestions,
  ...sportsQuestions,
  ...entertainmentQuestions,
  ...programmingQuestions,
];
