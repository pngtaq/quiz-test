"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { ERROR_MESSAGES } from "@shared/errors";
import type { RoomEvent } from "@shared/protocol";
import type { ClientRoomState } from "@shared/types";
import { isValidRoomCode, normalizeRoomCode } from "@shared/validation";
import { Lobby } from "@/components/lobby/Lobby";
import { FinalResults } from "@/components/quiz/FinalResults";
import { GameScreen } from "@/components/quiz/GameScreen";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingState } from "@/components/ui/LoadingState";
import { useQuizRoom, type FatalState } from "@/hooks/useQuizRoom";
import { useStoredSession } from "@/hooks/useStoredSession";
import type { StoredSession } from "@/lib/session";
import { ConnectionStatus } from "./ConnectionStatus";
import { JoinRoomForm } from "./JoinRoomForm";

type EndedState = FatalState | { reason: "INVALID_ROOM_CODE"; message: string };

export function RoomClient({ code }: { code: string }) {
  const roomCode = normalizeRoomCode(code);
  const { session, clear } = useStoredSession(roomCode);
  const [ended, setEnded] = useState<EndedState | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);

  if (!isValidRoomCode(roomCode)) {
    return <RoomGone state={{ reason: "INVALID_ROOM_CODE", message: ERROR_MESSAGES.INVALID_ROOM_CODE }} />;
  }
  if (ended) return <RoomGone state={ended} />;
  if (session === undefined) return <LoadingState message="Loading room…" />;

  if (session === null) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Join room {roomCode}</h1>
          <p className="mt-1 text-slate-600">Pick a nickname to jump in.</p>
        </div>
        <Card as="div">
          <JoinRoomForm initialCode={roomCode} lockCode notice={joinNotice} onJoined={() => setJoinNotice(null)} />
        </Card>
      </div>
    );
  }

  return (
    <ConnectedRoom
      key={session.sessionToken}
      roomCode={roomCode}
      session={session}
      onSessionEnded={(state) => {
        clear();
        if (state.reason === "INVALID_SESSION") setJoinNotice(state.message);
        else setEnded(state);
      }}
    />
  );
}

interface ConnectedRoomProps {
  roomCode: string;
  session: StoredSession;
  onSessionEnded: (state: FatalState) => void;
}

function ConnectedRoom({ roomCode, session, onSessionEnded }: ConnectedRoomProps) {
  const { room, connection, fatal, notice, dismissNotice, lastEvent, clockOffset, reconnect, actions } =
    useQuizRoom({ roomCode, sessionToken: session.sessionToken });
  const connected = connection === "connected";

  // Conditions that end this session hand control back to RoomClient.
  const endSession = useEffectEvent((state: FatalState) => onSessionEnded(state));
  useEffect(() => {
    if (fatal && ["ROOM_ENDED", "ROOM_NOT_FOUND", "INVALID_SESSION", "LEFT_ROOM"].includes(fatal.reason)) {
      endSession(fatal);
    }
  }, [fatal]);

  // Auto-dismiss transient errors.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(dismissNotice, 5_000);
    return () => window.clearTimeout(id);
  }, [notice, dismissNotice]);

  const leave = () => {
    if (!window.confirm("Leave this room?")) return;
    actions.leaveRoom();
    onSessionEnded({ reason: "LEFT_ROOM", message: "You left the room." });
  };

  if (fatal?.reason === "SESSION_REPLACED") {
    return (
      <CenteredCard icon="🗂️" title="Open in another tab" message={fatal.message}>
        <Button onClick={reconnect}>Use this tab instead</Button>
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
      </CenteredCard>
    );
  }
  if (fatal?.reason === "ORIGIN_NOT_ALLOWED" || fatal?.reason === "TOO_MANY_CONNECTIONS") {
    return (
      <CenteredCard icon="⚠️" title="Can't connect to this room" message={fatal.message}>
        <Button onClick={reconnect}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
      </CenteredCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-semibold text-slate-700">Room {roomCode}</span>
          <ConnectionStatus state={connection} />
        </div>
        <Button variant="ghost" size="sm" onClick={leave}>
          Leave room
        </Button>
      </div>

      {connection === "reconnecting" && room && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span aria-hidden="true">🟡 </span>Connection lost. Reconnecting…
        </p>
      )}
      {connection === "disconnected" && !fatal && (
        <ErrorMessage
          title="Unable to reconnect"
          message="We couldn't reach the quiz server. Check your internet connection and try again."
          action={
            <Button size="sm" onClick={reconnect}>
              Try again
            </Button>
          }
        />
      )}
      {notice && <ErrorMessage message={notice.message} onDismiss={dismissNotice} />}

      <p aria-live="polite" className="sr-only">
        {lastEvent && room ? announce(lastEvent.event, room) : ""}
      </p>

      {!room ? (
        <LoadingState message="Connecting to room…" />
      ) : room.status === "LOBBY" ? (
        <Lobby room={room} actions={actions} connected={connected} />
      ) : room.status === "QUESTION" || room.status === "ANSWER_REVEAL" ? (
        <GameScreen room={room} clockOffset={clockOffset} actions={actions} connected={connected} />
      ) : room.status === "RESULTS" ? (
        <FinalResults room={room} actions={actions} connected={connected} onLeave={leave} />
      ) : (
        <LoadingState message="Closing room…" />
      )}
    </div>
  );
}

/** Screen-reader announcement for a room event. */
function announce(event: RoomEvent, room: ClientRoomState): string {
  switch (event.type) {
    case "PLAYER_JOINED":
      return `${event.nickname} joined the room.`;
    case "PLAYER_LEFT":
      return `${event.nickname} left the room.`;
    case "LEADER_CHANGED":
      return event.playerId === room.me.playerId ? "You are now the leader." : `${event.nickname} is now the leader.`;
    case "SETTINGS_UPDATED":
      return "Quiz settings updated.";
    case "QUIZ_STARTED":
      return `Quiz started. Question 1 of ${room.totalQuestions}.`;
    case "QUESTION_STARTED":
      return `Question ${event.questionIndex + 1} of ${room.totalQuestions}.`;
    case "ANSWER_REVEALED":
      return "Time's up. Results for this question are in.";
    case "QUIZ_FINISHED":
      return "Quiz complete. Final results are in.";
    case "QUIZ_RESET":
      return "Back in the lobby.";
    default:
      return "";
  }
}

const GONE_COPY: Record<EndedState["reason"], { icon: string; title: string }> = {
  ROOM_ENDED: { icon: "🏁", title: "Room ended" },
  ROOM_NOT_FOUND: { icon: "🔍", title: "Room not found" },
  INVALID_ROOM_CODE: { icon: "🔍", title: "Invalid room code" },
  LEFT_ROOM: { icon: "👋", title: "You left the room" },
  INVALID_SESSION: { icon: "🔑", title: "Session expired" },
  SESSION_REPLACED: { icon: "🗂️", title: "Open in another tab" },
  ORIGIN_NOT_ALLOWED: { icon: "⚠️", title: "Can't connect" },
  TOO_MANY_CONNECTIONS: { icon: "⚠️", title: "Can't connect" },
};

function RoomGone({ state }: { state: EndedState }) {
  const { icon, title } = GONE_COPY[state.reason];
  return (
    <CenteredCard icon={icon} title={title} message={state.message}>
      <ButtonLink href="/">Back to home</ButtonLink>
      <ButtonLink href="/join" variant="secondary">
        Join another room
      </ButtonLink>
    </CenteredCard>
  );
}

function CenteredCard({
  icon,
  title,
  message,
  children,
}: {
  icon: string;
  title: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md py-6">
      <Card as="div" className="text-center">
        <p className="text-4xl" aria-hidden="true">
          {icon}
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-slate-600">{message}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">{children}</div>
      </Card>
    </div>
  );
}
