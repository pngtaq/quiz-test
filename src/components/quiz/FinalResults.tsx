"use client";

import type { ClientRoomState } from "@shared/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import type { QuizRoomActions } from "@/hooks/useQuizRoom";
import { formatNumber } from "@/lib/format";
import { Leaderboard } from "./Leaderboard";

interface FinalResultsProps {
  room: ClientRoomState;
  actions: QuizRoomActions;
  connected: boolean;
  onLeave: () => void;
}

function headline(room: ClientRoomState): string {
  const winners = room.leaderboard.filter((e) => e.rank === 1);
  if (winners.length === 0) return "";
  if (winners.length > 1) return `It's a tie between ${winners.map((w) => w.nickname).join(" and ")}!`;
  const [winner] = winners;
  if (!winner) return "";
  if (winner.playerId === room.me.playerId) return "You won! 🎉";
  return `${winner.nickname} wins with ${formatNumber(winner.score)} points!`;
}

export function FinalResults({ room, actions, connected, onLeave }: FinalResultsProps) {
  const me = room.leaderboard.find((e) => e.playerId === room.me.playerId);

  const confirmEnd = () => {
    if (window.confirm("End this room for everyone?")) actions.endRoom();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Quiz complete</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
          <span aria-hidden="true">🏆</span> Final leaderboard
        </h1>
        <p className="mt-2 text-slate-600">{headline(room)}</p>
      </div>

      {me && (
        <Card as="div">
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-xs text-slate-500">Your rank</dt>
              <dd className="text-2xl font-bold text-slate-900">#{me.rank}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Score</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">{formatNumber(me.score)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Accuracy</dt>
              <dd className="text-2xl font-bold text-slate-900">{me.accuracy}%</dd>
            </div>
          </dl>
        </Card>
      )}

      <Card title="Final standings">
        <Leaderboard entries={room.leaderboard} meId={room.me.playerId} showDetails />
      </Card>

      <Card as="div">
        {room.me.isLeader ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" fullWidth onClick={actions.playAgain} disabled={!connected}>
              Play Again
            </Button>
            <Button variant="danger" size="lg" fullWidth onClick={confirmEnd} disabled={!connected}>
              End Room
            </Button>
          </div>
        ) : (
          <p role="status" className="flex items-center justify-center gap-2 py-2 font-medium text-slate-700">
            <Spinner className="h-4 w-4 text-indigo-600" />
            Waiting for the leader…
          </p>
        )}
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={onLeave}>
            Leave room
          </Button>
        </div>
      </Card>
    </div>
  );
}
