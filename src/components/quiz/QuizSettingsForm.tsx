"use client";

import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  MAX_PLAYERS_OPTIONS,
  QUESTION_COUNT_OPTIONS,
  TIME_PER_QUESTION_OPTIONS,
} from "@shared/constants";
import type { CategorySetting, DifficultySetting, QuizSettings } from "@shared/types";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";

interface QuizSettingsFormProps {
  value: QuizSettings;
  onChange: (next: QuizSettings) => void;
  disabled?: boolean;
  /** Smallest selectable "max players" (the current player count in a lobby). */
  minPlayers?: number;
}

const LEGEND = "mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500";

export function QuizSettingsForm({ value, onChange, disabled, minPlayers = 1 }: QuizSettingsFormProps) {
  const update = <K extends keyof QuizSettings>(key: K, next: QuizSettings[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="space-y-6">
      <fieldset disabled={disabled}>
        <legend className={LEGEND}>Players</legend>
        <Select
          label="Maximum players"
          value={String(value.maxPlayers)}
          onChange={(e) => update("maxPlayers", Number(e.target.value))}
          options={MAX_PLAYERS_OPTIONS.filter((n) => n >= minPlayers || n === value.maxPlayers).map((n) => ({
            value: String(n),
            label: `${n} players`,
          }))}
        />
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className={LEGEND}>Questions</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Number of questions"
            value={String(value.questionCount)}
            onChange={(e) => update("questionCount", Number(e.target.value))}
            options={QUESTION_COUNT_OPTIONS.map((n) => ({ value: String(n), label: `${n} questions` }))}
          />
          <Select
            label="Difficulty"
            value={value.difficulty}
            onChange={(e) => update("difficulty", e.target.value as DifficultySetting)}
            options={DIFFICULTY_OPTIONS.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
          />
          <Select
            label="Category"
            value={value.category}
            onChange={(e) => update("category", e.target.value as CategorySetting)}
            options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          />
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className={LEGEND}>Gameplay</legend>
        <Select
          label="Time per question"
          value={String(value.timePerQuestion)}
          onChange={(e) => update("timePerQuestion", Number(e.target.value))}
          options={TIME_PER_QUESTION_OPTIONS.map((s) => ({ value: String(s), label: `${s} seconds` }))}
          hint="Faster correct answers earn a bigger speed bonus."
        />
        <div className="mt-2 divide-y divide-slate-100">
          <Toggle
            label="Randomize questions"
            description="Pick and order questions randomly. When off, questions go from easiest to hardest."
            checked={value.randomizeQuestions}
            onChange={(checked) => update("randomizeQuestions", checked)}
            disabled={disabled}
          />
          <Toggle
            label="Randomize answer choices"
            description="Shuffle the order of the answers for each question."
            checked={value.randomizeAnswers}
            onChange={(checked) => update("randomizeAnswers", checked)}
            disabled={disabled}
          />
          <Toggle
            label="Allow late joining"
            description="Let players join after the quiz has started."
            checked={value.allowLateJoin}
            onChange={(checked) => update("allowLateJoin", checked)}
            disabled={disabled}
          />
          <Toggle
            label="Show correct answer after each question"
            description="Reveal the right answer and each player's result between questions."
            checked={value.showCorrectAnswer}
            onChange={(checked) => update("showCorrectAnswer", checked)}
            disabled={disabled}
          />
        </div>
      </fieldset>
    </div>
  );
}
