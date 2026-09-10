import type { PublicPlayer } from "@shared/types";
import { Badge } from "@/components/ui/Badge";
import { PlayerAvatar } from "./PlayerAvatar";

interface PlayerListProps {
  players: PublicPlayer[];
  meId: string;
  /** Show whether each player has answered the current question. */
  showAnswered?: boolean;
}

export function PlayerList({ players, meId, showAnswered = false }: PlayerListProps) {
  if (players.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No players yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100" aria-label="Players">
      {players.map((player) => (
        <li key={player.id} className="flex items-center gap-3 py-2.5">
          <PlayerAvatar nickname={player.nickname} dimmed={!player.connected} />
          <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
            {player.isLeader && (
              <span role="img" aria-label="Leader" className="mr-1">
                👑
              </span>
            )}
            {player.nickname}
            {player.id === meId && <span className="font-normal text-slate-500"> (you)</span>}
          </span>
          <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {player.isLeader && <Badge tone="brand">Leader</Badge>}
            {!player.connected && <Badge tone="warning">Offline</Badge>}
            {showAnswered &&
              (player.answered ? (
                <Badge tone="success">✓ Answered</Badge>
              ) : (
                <Badge>Thinking…</Badge>
              ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
