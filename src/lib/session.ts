/**
 * Player credentials per room, kept in sessionStorage.
 *
 * sessionStorage is scoped to a browser tab and survives reloads, which gives
 * us exactly the identity semantics we want: refreshing reconnects as the same
 * player, while a second tab in the same browser can join as a different
 * player (handy for local multiplayer testing).
 */
import { isRecord } from "@shared/validation";

export interface StoredSession {
  playerId: string;
  sessionToken: string;
}

const KEY_PREFIX = "quiz-together:session:";
const CHANGE_EVENT = "quiz-together:session-change";

/** Fallback when storage is unavailable (e.g. blocked by privacy settings). */
const memoryStore = new Map<string, string>();

const storageKey = (roomCode: string) => `${KEY_PREFIX}${roomCode}`;

export function readSessionRaw(roomCode: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(roomCode));
  } catch {
    return memoryStore.get(storageKey(roomCode)) ?? null;
  }
}

export function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (isRecord(data) && typeof data.playerId === "string" && typeof data.sessionToken === "string") {
      return { playerId: data.playerId, sessionToken: data.sessionToken };
    }
  } catch {
    // Corrupt entry: treat as missing.
  }
  return null;
}

export function loadSession(roomCode: string): StoredSession | null {
  return parseSession(readSessionRaw(roomCode));
}

export function saveSession(roomCode: string, session: StoredSession): void {
  const value = JSON.stringify(session);
  try {
    window.sessionStorage.setItem(storageKey(roomCode), value);
  } catch {
    memoryStore.set(storageKey(roomCode), value);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearSession(roomCode: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(roomCode));
  } catch {
    // Ignore storage errors.
  }
  memoryStore.delete(storageKey(roomCode));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToSessions(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
