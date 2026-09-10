const DEFAULT_REALTIME_URL = "http://localhost:8787";

/**
 * Base URL of the realtime Worker. `NEXT_PUBLIC_*` variables are inlined at
 * build time, so this must be set before `next build` / `opennextjs-cloudflare build`.
 */
export const REALTIME_URL = (process.env.NEXT_PUBLIC_REALTIME_URL || DEFAULT_REALTIME_URL).replace(
  /\/+$/,
  "",
);

export function apiUrl(path: string): string {
  return `${REALTIME_URL}${path}`;
}

/** ws:// or wss:// URL for a room's WebSocket endpoint. */
export function roomSocketUrl(roomCode: string): string {
  const url = new URL(`/api/rooms/${encodeURIComponent(roomCode)}/ws`, REALTIME_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
