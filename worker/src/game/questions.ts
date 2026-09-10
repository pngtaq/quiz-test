import { CATEGORIES, DIFFICULTIES } from "../../../shared/constants";
import type { QuizSettings } from "../../../shared/types";
import { QUESTION_BANK } from "../data/questions";
import { shuffle } from "../lib/random";
import type { QuestionSource, RoomQuestion } from "./types";

/**
 * Abstraction over where questions come from. Swap `LocalQuestionProvider`
 * for an implementation that calls an external API (map its response to
 * `QuestionSource`, then reuse `prepareQuestion`) without touching the engine.
 */
export interface QuestionProvider {
  getQuestions(settings: QuizSettings): Promise<RoomQuestion[]>;
}

export class LocalQuestionProvider implements QuestionProvider {
  constructor(
    private readonly bank: readonly QuestionSource[] = QUESTION_BANK,
    private readonly random: () => number = Math.random,
  ) {}

  async getQuestions(settings: QuizSettings): Promise<RoomQuestion[]> {
    return selectQuestions(this.bank, settings, this.random);
  }
}

const difficultyRank = (q: QuestionSource) => DIFFICULTIES.indexOf(q.difficulty);
const categoryRank = (q: QuestionSource) => CATEGORIES.indexOf(q.category);

/**
 * Deterministic order used when "Randomize questions" is off: round-robin
 * across categories and difficulties, so a fixed quiz still has variety.
 */
function deterministicOrder(questions: readonly QuestionSource[]): QuestionSource[] {
  const seen = new Map<string, number>();
  const keyed = questions.map((q) => {
    const group = `${q.category}:${q.difficulty}`;
    const occurrence = seen.get(group) ?? 0;
    seen.set(group, occurrence + 1);
    return { q, occurrence };
  });
  keyed.sort(
    (a, b) =>
      a.occurrence - b.occurrence ||
      categoryRank(a.q) - categoryRank(b.q) ||
      difficultyRank(a.q) - difficultyRank(b.q),
  );
  return keyed.map((k) => k.q);
}

/**
 * Picks `settings.questionCount` questions. Preference order when a filter
 * doesn't have enough questions:
 *   1. requested category + requested difficulty
 *   2. requested category, other difficulties
 *   3. other categories, requested difficulty
 *   4. anything else
 */
export function selectQuestions(
  bank: readonly QuestionSource[],
  settings: QuizSettings,
  random: () => number,
): RoomQuestion[] {
  const inCategory = (q: QuestionSource) =>
    settings.category === "random" || q.category === settings.category;
  const matchesDifficulty = (q: QuestionSource) =>
    settings.difficulty === "mixed" || q.difficulty === settings.difficulty;

  const tiers = [
    bank.filter((q) => inCategory(q) && matchesDifficulty(q)),
    bank.filter((q) => inCategory(q) && !matchesDifficulty(q)),
    bank.filter((q) => !inCategory(q) && matchesDifficulty(q)),
    bank.filter((q) => !inCategory(q) && !matchesDifficulty(q)),
  ];

  const picked: QuestionSource[] = [];
  for (const tier of tiers) {
    const ordered = settings.randomizeQuestions
      ? shuffle(tier, random)
      : deterministicOrder(tier);
    for (const question of ordered) {
      if (picked.length >= settings.questionCount) break;
      picked.push(question);
    }
  }

  const finalOrder = settings.randomizeQuestions
    ? shuffle(picked, random)
    : [...picked].sort((a, b) => difficultyRank(a) - difficultyRank(b));

  return finalOrder.map((q) => prepareQuestion(q, settings.randomizeAnswers, random));
}

/** Converts a source question into a room question, optionally shuffling choices. */
export function prepareQuestion(
  source: QuestionSource,
  randomizeAnswers: boolean,
  random: () => number,
): RoomQuestion {
  const indices = source.answers.map((_, i) => i);
  const order = randomizeAnswers ? shuffle(indices, random) : indices;
  return {
    id: source.id,
    text: source.question,
    choices: order.map((i) => source.answers[i] as string),
    correctIndex: order.indexOf(source.correctAnswer),
    category: source.category,
    difficulty: source.difficulty,
  };
}
