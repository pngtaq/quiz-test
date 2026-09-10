"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ERROR_MESSAGES } from "@shared/errors";
import {
  CloseCode,
  PING_MESSAGE,
  type ClientMessage,
  type RoomEvent,
  type ServerMessage,
} from "@shared/protocol";
import type { ClientRoomState, ErrorCode, QuizSettings } from "@shared/types";
import { isRecord } from "@shared/validation";
import { roomSocketUrl } from "@/lib/config";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export type FatalReason =
  | "ROOM_NOT_FOUND"
  | "INVALID_SESSION"
  | "ROOM_ENDED"
  | "LEFT_ROOM"
  | "SESSION_REPLACED"
  | "ORIGIN_NOT_ALLOWED"
  | "TOO_MANY_CONNECTIONS";

/** A condition after which we stop reconnecting automatically. */
export interface FatalState {
  reason: FatalReason;
  message: string;
}

export interface Notice {
  id: number;
  message: string;
}

export interface RoomEventNotification {
  id: number;
  event: RoomEvent;
}

const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 3_000, 5_000, 8_000, 10_000, 10_000, 10_000, 10_000];
const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 40_000;

const FATAL_BY_CLOSE_CODE: Record<number, FatalState> = {
  [CloseCode.ROOM_ENDED]: { reason: "ROOM_ENDED", message: "This room has ended." },
  [CloseCode.LEFT_ROOM]: { reason: "LEFT_ROOM", message: "You left the room." },
  [CloseCode.INVALID_SESSION]: { reason: "INVALID_SESSION", message: ERROR_MESSAGES.INVALID_SESSION },
  [CloseCode.ORIGIN_NOT_ALLOWED]: { reason: "ORIGIN_NOT_ALLOWED", message: ERROR_MESSAGES.ORIGIN_NOT_ALLOWED },
  [CloseCode.ROOM_NOT_FOUND]: { reason: "ROOM_NOT_FOUND", message: ERROR_MESSAGES.ROOM_NOT_FOUND },
  [CloseCode.SESSION_REPLACED]: {
    reason: "SESSION_REPLACED",
    message: "This room was opened in another tab or window.",
  },
  [CloseCode.TOO_MANY_CONNECTIONS]: {
    reason: "TOO_MANY_CONNECTIONS",
    message: ERROR_MESSAGES.TOO_MANY_CONNECTIONS,
  },
};

const FATAL_BY_ERROR_CODE: Partial<Record<ErrorCode, FatalReason>> = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  INVALID_ROOM_CODE: "ROOM_NOT_FOUND",
  INVALID_SESSION: "INVALID_SESSION",
  ORIGIN_NOT_ALLOWED: "ORIGIN_NOT_ALLOWED",
  TOO_MANY_CONNECTIONS: "TOO_MANY_CONNECTIONS",
};

let sequence = 0;
const nextId = () => ++sequence;

function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(data);
    if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
    if ("room" in parsed && !isRecord(parsed.room)) return null;
    return parsed as unknown as ServerMessage;
  } catch {
    return null;
  }
}

export interface UseQuizRoomOptions {
  roomCode: string;
  sessionToken: string;
}

/**
 * Owns the room WebSocket: joins with the session token, keeps the latest
 * authoritative snapshot, reconnects with backoff, sends heartbeats, and
 * exposes typed actions. The server is the single source of truth. This hook
 * never mutates `room` locally.
 */
export function useQuizRoom({ roomCode, sessionToken }: UseQuizRoomOptions) {
  const [room, setRoom] = useState<ClientRoomState | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [fatal, setFatal] = useState<FatalState | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lastEvent, setLastEvent] = useState<RoomEventNotification | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [connectKey, setConnectKey] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let stopped = false; // a fatal condition was reached
    let socket: WebSocket | null = null;
    let attempt = 0;
    let reconnectTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let lastSeen = 0;
    const offsets: number[] = [];

    const stop = (state: FatalState) => {
      stopped = true;
      setFatal(state);
      setConnection("disconnected");
    };

    const scheduleReconnect = () => {
      if (disposed || stopped) return;
      const delay = RECONNECT_DELAYS_MS[attempt];
      if (delay === undefined) {
        setConnection("disconnected");
        return;
      }
      attempt += 1;
      setConnection("reconnecting");
      reconnectTimer = window.setTimeout(connect, delay);
    };

    const handleMessage = (message: ServerMessage) => {
      switch (message.type) {
        case "PONG":
          return;
        case "ERROR": {
          const reason = FATAL_BY_ERROR_CODE[message.code];
          if (reason) stop({ reason, message: message.message });
          else setNotice({ id: nextId(), message: message.message });
          return;
        }
        case "ROOM_ENDED":
          stop({ reason: "ROOM_ENDED", message: message.message });
          return;
        default: {
          const { room: snapshot, serverTime, ...event } = message;
          // Max of recent samples approximates the true offset (latency only lowers it).
          offsets.push(serverTime - Date.now());
          if (offsets.length > 5) offsets.shift();
          setClockOffset(Math.max(...offsets));
          attempt = 0;
          setConnection("connected");
          setRoom(snapshot);
          setLastEvent({ id: nextId(), event: event as RoomEvent });
        }
      }
    };

    function connect() {
      if (disposed || stopped) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(roomSocketUrl(roomCode));
      } catch {
        window.setTimeout(scheduleReconnect, 0);
        return;
      }
      socket = ws;
      socketRef.current = ws;

      ws.onopen = () => {
        lastSeen = Date.now();
        const join: ClientMessage = { type: "JOIN_ROOM", sessionToken };
        ws.send(JSON.stringify(join));
        heartbeatTimer = window.setInterval(() => {
          if (Date.now() - lastSeen > HEARTBEAT_TIMEOUT_MS) {
            ws.close(); // half-open connection: force a reconnect
            return;
          }
          if (ws.readyState === WebSocket.OPEN) ws.send(PING_MESSAGE);
        }, HEARTBEAT_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        lastSeen = Date.now();
        const message = parseServerMessage(event.data);
        if (message) handleMessage(message);
      };

      ws.onclose = (event) => {
        window.clearInterval(heartbeatTimer);
        if (socketRef.current === ws) socketRef.current = null;
        if (disposed || stopped) return;
        const fatalForCode = FATAL_BY_CLOSE_CODE[event.code];
        if (fatalForCode) stop(fatalForCode);
        else scheduleReconnect();
      };
    }

    connect();

    // Reconnect immediately when the network or tab comes back.
    const wake = () => {
      if (disposed || stopped || document.visibilityState === "hidden") return;
      if (socket && socket.readyState !== WebSocket.CLOSED) return;
      window.clearTimeout(reconnectTimer);
      attempt = 0;
      connect();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);

    return () => {
      disposed = true;
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      socket?.close(CloseCode.NORMAL, "Client closed");
      socketRef.current = null;
    };
  }, [roomCode, sessionToken, connectKey]);

  const send = useCallback((message: ClientMessage): boolean => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setNotice({ id: nextId(), message: "Connection lost. Reconnecting…" });
      return false;
    }
    ws.send(JSON.stringify(message));
    return true;
  }, []);

  /** Manual retry after giving up, or to take over from another tab. */
  const reconnect = useCallback(() => {
    setFatal(null);
    setConnection("connecting");
    setConnectKey((key) => key + 1);
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const actions = useMemo(
    () => ({
      updateSettings: (settings: QuizSettings) => send({ type: "UPDATE_SETTINGS", settings }),
      startQuiz: () => send({ type: "START_QUIZ" }),
      submitAnswer: (questionIndex: number, choiceIndex: number) =>
        send({ type: "SUBMIT_ANSWER", questionIndex, choiceIndex }),
      nextQuestion: () => send({ type: "NEXT_QUESTION" }),
      playAgain: () => send({ type: "PLAY_AGAIN" }),
      leaveRoom: () => send({ type: "LEAVE_ROOM" }),
      endRoom: () => send({ type: "END_ROOM" }),
    }),
    [send],
  );

  return {
    room,
    connection,
    fatal,
    notice,
    dismissNotice,
    lastEvent,
    clockOffset,
    reconnect,
    actions,
  };
}

export type QuizRoomActions = ReturnType<typeof useQuizRoom>["actions"];
