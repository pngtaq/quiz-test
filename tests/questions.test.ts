import { describe, expect, it } from "vitest";
import { CATEGORIES, DEFAULT_SETTINGS, DIFFICULTIES } from "../shared/constants";
import type { QuizSettings } from "../shared/types";
import { QUESTION_BANK } from "../worker/src/data/questions";
import { prepareQuestion, selectQuestions } from "../worker/src/game/questions";
import { seededRandom } from "./helpers";

const settings = (overrides: Partial<QuizSettings>): QuizSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

describe("question bank", () => {
  it("is well-formed", () => {
    const ids = new Set(QUESTION_BANK.map((q) => q.id));
    expect(ids.size).toBe(QUESTION_BANK.length);
    for (const q of QUESTION_BANK) {
      expect(q.answers).toHaveLength(4);
      expect(new Set(q.answers).size).toBe(4);
      expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
      expect(q.correctAnswer).toBeLessThan(q.answers.length);
    }
  });

  it("covers every category and difficulty", () => {
    for (const category of CATEGORIES) {
      for (const difficulty of DIFFICULTIES) {
        const count = QUESTION_BANK.filter(
          (q) => q.category === category && q.difficulty === difficulty,
        ).length;
        expect(count, `${category}/${difficulty}`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe("selectQuestions", () => {
  it("honours the question count without duplicates", () => {
    for (const questionCount of [5, 10, 15, 20]) {
      const picked = selectQuestions(QUESTION_BANK, settings({ questionCount }), seededRandom(1));
      expect(picked).toHaveLength(questionCount);
      expect(new Set(picked.map((q) => q.id)).size).toBe(questionCount);
    }
  });

  it("filters by category and difficulty", () => {
    const picked = selectQuestions(
      QUESTION_BANK,
      settings({ category: "science", difficulty: "easy", questionCount: 5 }),
      seededRandom(2),
    );
    expect(picked.every((q) => q.category === "science" && q.difficulty === "easy")).toBe(true);
  });

  it("falls back to other questions when a filter runs out, preferring the category", () => {
    const picked = selectQuestions(
      QUESTION_BANK,
      settings({ category: "history", difficulty: "hard", questionCount: 20 }),
      seededRandom(3),
    );
    expect(picked).toHaveLength(20);
    const historyCount = QUESTION_BANK.filter((q) => q.category === "history").length;
    expect(picked.filter((q) => q.category === "history")).toHaveLength(historyCount);
    const hardHistory = QUESTION_BANK.filter((q) => q.category === "history" && q.difficulty === "hard");
    for (const q of hardHistory) expect(picked.map((p) => p.id)).toContain(q.id);
  });

  it("picks different questions for different random seeds", () => {
    const a = selectQuestions(QUESTION_BANK, settings({}), seededRandom(10)).map((q) => q.id);
    const b = selectQuestions(QUESTION_BANK, settings({}), seededRandom(11)).map((q) => q.id);
    expect(a).not.toEqual(b);
  });

  it("is deterministic and ordered easy to hard when randomization is off", () => {
    const fixed = settings({ randomizeQuestions: false, randomizeAnswers: false });
    const a = selectQuestions(QUESTION_BANK, fixed, seededRandom(1));
    const b = selectQuestions(QUESTION_BANK, fixed, seededRandom(99));
    expect(a).toEqual(b);
    const ranks = a.map((q) => DIFFICULTIES.indexOf(q.difficulty));
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
  });
});

describe("prepareQuestion", () => {
  it("keeps the correct answer attached to the right text after shuffling", () => {
    for (const source of QUESTION_BANK) {
      const prepared = prepareQuestion(source, true, seededRandom(source.id.length));
      expect(prepared.choices[prepared.correctIndex]).toBe(source.answers[source.correctAnswer]);
      expect([...prepared.choices].sort()).toEqual([...source.answers].sort());
    }
  });
});
