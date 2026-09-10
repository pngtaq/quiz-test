"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  clearSession,
  parseSession,
  readSessionRaw,
  saveSession,
  subscribeToSessions,
  type StoredSession,
} from "@/lib/session";

/**
 * Reads the stored session for a room. Returns `undefined` during server
 * rendering / hydration (storage isn't available yet), then the session or null.
 */
export function useStoredSession(roomCode: string) {
  const raw = useSyncExternalStore(
    subscribeToSessions,
    () => readSessionRaw(roomCode),
    () => undefined,
  );

  const session: StoredSession | null | undefined = useMemo(
    () => (raw === undefined ? undefined : parseSession(raw)),
    [raw],
  );

  const save = useCallback((value: StoredSession) => saveSession(roomCode, value), [roomCode]);
  const clear = useCallback(() => clearSession(roomCode), [roomCode]);

  return { session, save, clear };
}
