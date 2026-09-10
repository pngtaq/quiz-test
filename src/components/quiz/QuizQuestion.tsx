"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "@shared/constants";
import type { ClientRoomState } from "@shared/types";
import { Badge } from "@/components/ui/Badge";
import { AnswerButton, type AnswerState } from "./AnswerButton";
import { Timer } from "./Timer";

interface QuizQuestionProps {
  room: ClientRoomState;
  clockOffset: number;
  /** Sends the answer; returns false if it couldn't be sent. */
  onAnswer: (choiceIndex: number) => boolean;
}

const KEY_TO_CHOICE: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };

export function QuizQuestion({ room, clockOffset, onAnswer }: QuizQuestionProps) {
  // Local, non-authoritative UI state: which choice we've sent but not yet
  // seen confirmed in a server snapshot.
  const [pending, setPending] = useState<{ questionIndex: number; choice: number } | null>(null);

  const question = room.question;
  const isReveal = room.status === "ANSWER_REVEAL";
  const pendingChoice = pending?.questionIndex === room.questionIndex ? pending.choice : null;
  const selected = room.myAnswer ?? pendingChoice;
  const locked = isReveal || selected !== null;

  const choose = (choice: number) => {
    if (locked || !question || choice >= question.choices.length) return;
    if (onAnswer(choice)) setPending({ questionIndex: room.questionIndex, choice });
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
    const choice = KEY_TO_CHOICE[event.key.toLowerCase()];
    if (choice !== undefined) choose(choice);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (!question) return null;

  const correctIndex = room.reveal?.correctIndex ?? null;
  const stateFor = (index: number): AnswerState => {
    if (isReveal) {
      if (correctIndex !== null && index === correctIndex) return "correct";
      if (index === selected) return correctIndex !== null ? "incorrect" : "selected";
      return "dimmed";
    }
    if (index === room.myAnswer) return "selected";
    if (index === pendingChoice) return "pending";
    return locked ? "dimmed" : "idle";
  };

  const onlinePlayers = room.players.filter((p) => p.connected).length;

  return (
    <section aria-labelledby="question-text" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600">
          Question {room.questionIndex + 1} / {room.totalQuestions}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{CATEGORY_LABELS[question.category]}</Badge>
          <Badge>{DIFFICULTY_LABELS[question.difficulty]}</Badge>
        </div>
      </div>

      {room.status === "QUESTION" && (
        <Timer
          deadline={room.phaseEndsAt}
          totalMs={room.settings.timePerQuestion * 1000}
          clockOffset={clockOffset}
        />
      )}

      <h1 id="question-text" className="text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">
        {question.text}
      </h1>

      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Answer choices">
        {question.choices.map((choice, index) => (
          <AnswerButton
            key={`${question.id}-${index}`}
            index={index}
            text={choice}
            state={stateFor(index)}
            disabled={locked}
            onSelect={() => choose(index)}
            count={isReveal ? (room.reveal?.choiceCounts?.[index] ?? null) : null}
          />
        ))}
      </div>

      {room.status === "QUESTION" && (
        <p role="status" className="text-center text-sm text-slate-600">
          {room.myAnswer !== null
            ? "✓ Answer submitted. Waiting for others…"
            : pendingChoice !== null
              ? "Submitting your answer…"
              : "Choose an answer (tip: press 1–4)"}
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          {room.answeredCount}/{onlinePlayers} answered
        </p>
      )}
    </section>
  );
}
