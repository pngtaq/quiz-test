import type { LeaderboardEntry } from "@shared/types";
import { formatNumber, rankLabel } from "@/lib/format";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  meId: string;
  /** Show correct answers and accuracy (final results). */
  showDetails?: boolean;
  /** Show only the top N, plus the viewer if they're further down. */
  limit?: number;
}

export function Leaderboard({ entries, meId, showDetails = false, limit }: LeaderboardProps) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No scores yet.</p>;
  }

  const visible = limit ? entries.slice(0, limit) : entries;
  const me = entries.find((e) => e.playerId === meId);
  const rows = me && !visible.includes(me) ? [...visible, me] : visible;

  return (
    <ol className="space-y-2" aria-label="Leaderboard">
      {rows.map((entry) => {
        const isMe = entry.playerId === meId;
        return (
          <li
            key={entry.playerId}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
              isMe ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
            }`}
          >
            <span className="w-10 shrink-0 text-center text-lg font-bold text-slate-700">
              <span aria-hidden="true">{rankLabel(entry.rank)}</span>
              <span className="sr-only">Rank {entry.rank}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-900">
                {entry.nickname}
                {isMe && <span className="font-normal text-slate-500"> (you)</span>}
                {!entry.connected && <span className="ml-1 text-xs font-normal text-slate-500">(offline)</span>}
              </span>
              {showDetails && (
                <span className="block text-xs text-slate-600">
                  {entry.correctAnswers}/{entry.totalQuestions} correct · {entry.accuracy}% accuracy
                </span>
              )}
            </span>
            <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-slate-900">
              {formatNumber(entry.score)}
              <span className="sr-only"> points</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
