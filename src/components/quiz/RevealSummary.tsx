"use client";

import type { ClientRoomState } from "@shared/types";
import { useServerCountdown } from "@/hooks/useNow";
import { answerLetter, formatNumber } from "@/lib/format";

interface RevealSummaryProps {
  room: ClientRoomState;
  clockOffset: number;
}

const TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  danger: "border-red-200 bg-red-50 text-red-900",
  neutral: "border-slate-200 bg-slate-50 text-slate-900",
};

export function RevealSummary({ room, clockOffset }: RevealSummaryProps) {
  const remainingMs = useServerCountdown(room.phaseEndsAt, clockOffset);
  const seconds = Math.ceil(remainingMs / 1000);
  const isLast = room.questionIndex + 1 >= room.totalQuestions;
  const result = room.reveal?.myResult ?? null;
  const correctIndex = room.reveal?.correctIndex ?? null;
  const correctText = correctIndex !== null ? room.question?.choices[correctIndex] : undefined;

  let tone: keyof typeof TONES = "neutral";
  let icon = "🔒";
  let title = "Answers locked in";
  let detail = "Correct answers are hidden in this quiz.";

  if (result) {
    if (result.choiceIndex === null) {
      icon = "⏱️";
      title = "Time's up!";
      detail = "You didn't answer this one.";
    } else if (result.correct) {
      tone = "success";
      icon = "🎉";
      title = "Correct!";
      detail = `+${formatNumber(result.pointsAwarded)} points`;
    } else {
      tone = "danger";
      icon = "❌";
      title = "Not quite";
      detail = "No points this round.";
    }
  }

  return (
    <div role="status" className={`rounded-2xl border p-4 ${TONES[tone]}`}>
      <p className="text-lg font-bold">
        <span aria-hidden="true">{icon}</span> {title}
      </p>
      <p className="text-sm">{detail}</p>
      {correctIndex !== null && correctText !== undefined && (
        <p className="mt-2 text-sm">
          Correct answer:{" "}
          <strong>
            {answerLetter(correctIndex)}. {correctText}
          </strong>
        </p>
      )}
      <p className="mt-2 text-xs opacity-80">
        {isLast ? "Final results" : "Next question"} in {seconds}s
      </p>
    </div>
  );
}
