import { answerLetter } from "@/lib/format";

export type AnswerState = "idle" | "pending" | "selected" | "correct" | "incorrect" | "dimmed";

interface AnswerButtonProps {
  index: number;
  text: string;
  state: AnswerState;
  disabled: boolean;
  onSelect: () => void;
  /** Number of players who picked this answer (reveal only). */
  count?: number | null;
}

const CONTAINER: Record<AnswerState, string> = {
  idle: "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer",
  pending: "border-indigo-400 bg-indigo-50",
  selected: "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600",
  correct: "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600",
  incorrect: "border-red-500 bg-red-50",
  dimmed: "border-slate-200 bg-white opacity-60",
};

const LETTER: Record<AnswerState, string> = {
  idle: "bg-slate-800",
  pending: "bg-indigo-500",
  selected: "bg-indigo-600",
  correct: "bg-emerald-600",
  incorrect: "bg-red-600",
  dimmed: "bg-slate-500",
};

/** Text labels so state never relies on color alone. */
const STATUS_LABEL: Partial<Record<AnswerState, string>> = {
  pending: "Sending…",
  selected: "Your answer",
  correct: "✓ Correct",
  incorrect: "✗ Your answer",
};

export function AnswerButton({ index, text, state, disabled, onSelect, count }: AnswerButtonProps) {
  const letter = answerLetter(index);
  const status = STATUS_LABEL[state];

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={state === "selected" || state === "pending" || state === "incorrect"}
      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-default ${CONTAINER[state]}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold text-white ${LETTER[state]}`}
      >
        {letter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">Answer {letter}: </span>
        <span className="block text-base font-medium text-slate-900 sm:text-lg">{text}</span>
        {(status || count != null) && (
          <span className="mt-0.5 block text-xs font-semibold text-slate-700">
            {status}
            {status && count != null && " · "}
            {count != null && `${count} ${count === 1 ? "vote" : "votes"}`}
          </span>
        )}
      </span>
    </button>
  );
}
