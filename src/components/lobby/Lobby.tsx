"use client";

import { useEffect, useState } from "react";
import type { ClientRoomState } from "@shared/types";
import { QuizSettingsForm } from "@/components/quiz/QuizSettingsForm";
import { SettingsSummary } from "@/components/quiz/SettingsSummary";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import type { QuizRoomActions } from "@/hooks/useQuizRoom";
import { PlayerList } from "./PlayerList";
import { RoomCode } from "./RoomCode";

interface LobbyProps {
  room: ClientRoomState;
  actions: QuizRoomActions;
  connected: boolean;
}

export function Lobby({ room, actions, connected }: LobbyProps) {
  const isLeader = room.me.isLeader;
  const [starting, setStarting] = useState(false);
  const onlineCount = room.players.filter((p) => p.connected).length;

  // If the start request fails (the room stays in the lobby), re-enable the button.
  useEffect(() => {
    if (!starting) return;
    const id = window.setTimeout(() => setStarting(false), 4_000);
    return () => window.clearTimeout(id);
  }, [starting]);

  const start = () => {
    if (actions.startQuiz()) setStarting(true);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
      <div className="space-y-6">
        <Card>
          <RoomCode code={room.roomCode} />
        </Card>
        <Card
          title={`Players (${room.players.length}/${room.settings.maxPlayers})`}
          description={`${onlineCount} online`}
        >
          <PlayerList players={room.players} meId={room.me.playerId} />
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          {isLeader ? (
            <div className="space-y-3">
              <Button
                size="lg"
                fullWidth
                onClick={start}
                loading={starting}
                loadingText="Starting…"
                disabled={!connected}
              >
                Start Quiz
              </Button>
              <p className="text-center text-sm text-slate-600">
                {room.players.length === 1
                  ? "Waiting for friends? You can also start on your own."
                  : `${onlineCount} ${onlineCount === 1 ? "player is" : "players are"} ready.`}
              </p>
            </div>
          ) : (
            <p role="status" className="flex items-center justify-center gap-2 py-2 text-center font-medium text-slate-700">
              <Spinner className="h-4 w-4 text-indigo-600" />
              Waiting for the leader to start the quiz…
            </p>
          )}
        </Card>

        <Card
          title="Quiz settings"
          description={isLeader ? "Changes are shared with everyone instantly." : "Chosen by the leader."}
        >
          {isLeader ? (
            <QuizSettingsForm
              value={room.settings}
              onChange={actions.updateSettings}
              disabled={!connected}
              minPlayers={room.players.length}
            />
          ) : (
            <SettingsSummary settings={room.settings} />
          )}
        </Card>
      </div>
    </div>
  );
}
