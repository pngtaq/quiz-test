"use client";

import { useServerCountdown } from "@/hooks/useNow";

interface TimerProps {
  /** Server epoch ms when the question closes. */
  deadline: number | null;
  totalMs: number;
  clockOffset: number;
}

export function Timer({ deadline, totalMs, clockOffset }: TimerProps) {
  const remainingMs = useServerCountdown(deadline, clockOffset);
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
  const urgent = seconds <= 5;

  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${seconds} seconds remaining`}>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
            urgent ? "bg-red-500" : "bg-indigo-600"
          }`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span
        aria-hidden="true"
        className={`min-w-16 rounded-lg px-2 py-1 text-center font-mono text-lg font-bold tabular-nums ${
          urgent ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-900"
        }`}
      >
        {urgent && "⏰ "}
        {seconds}s
      </span>
    </div>
  );
}
