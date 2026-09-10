"use client";

import type { ClientRoomState } from "@shared/types";
import { PlayerList } from "@/components/lobby/PlayerList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { QuizRoomActions } from "@/hooks/useQuizRoom";
import { Leaderboard } from "./Leaderboard";
import { QuizQuestion } from "./QuizQuestion";
import { RevealSummary } from "./RevealSummary";

interface GameScreenProps {
  room: ClientRoomState;
  clockOffset: number;
  actions: QuizRoomActions;
  connected: boolean;
}

/** QUESTION and ANSWER_REVEAL phases. */
export function GameScreen({ room, clockOffset, actions, connected }: GameScreenProps) {
  const isReveal = room.status === "ANSWER_REVEAL";
  const isLast = room.questionIndex + 1 >= room.totalQuestions;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
      <Card as="div">
        <QuizQuestion
          room={room}
          clockOffset={clockOffset}
          onAnswer={(choice) => actions.submitAnswer(room.questionIndex, choice)}
        />
        {isReveal && (
          <div className="mt-5">
            <RevealSummary room={room} clockOffset={clockOffset} />
          </div>
        )}
        {room.me.isLeader && (
          <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
            <Button
              variant={isReveal ? "primary" : "secondary"}
              size="sm"
              onClick={actions.nextQuestion}
              disabled={!connected}
            >
              {isReveal ? (isLast ? "Show results" : "Next question →") : "End question now"}
            </Button>
          </div>
        )}
      </Card>

      <Card title={isReveal ? "Leaderboard" : "Players"}>
        {isReveal ? (
          <Leaderboard entries={room.leaderboard} meId={room.me.playerId} limit={5} />
        ) : (
          <PlayerList players={room.players} meId={room.me.playerId} showAnswered />
        )}
      </Card>
    </div>
  );
}
