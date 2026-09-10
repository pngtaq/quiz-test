import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "@shared/constants";
import type { QuizSettings } from "@shared/types";

export function SettingsSummary({ settings }: { settings: QuizSettings }) {
  const items: [string, string][] = [
    ["Questions", String(settings.questionCount)],
    ["Difficulty", DIFFICULTY_LABELS[settings.difficulty]],
    ["Category", CATEGORY_LABELS[settings.category]],
    ["Time per question", `${settings.timePerQuestion}s`],
    ["Max players", String(settings.maxPlayers)],
    ["Randomize questions", settings.randomizeQuestions ? "Yes" : "No"],
    ["Randomize answers", settings.randomizeAnswers ? "Yes" : "No"],
    ["Late joining", settings.allowLateJoin ? "Allowed" : "Not allowed"],
    ["Show answers", settings.showCorrectAnswer ? "After each question" : "Hidden"],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="text-sm font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
