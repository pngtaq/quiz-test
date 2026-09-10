"use client";

import { useEffect, useState } from "react";

/** Current `Date.now()`, refreshed every `intervalMs` while `active`. */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);

  return now;
}

/**
 * Milliseconds until a server-side deadline. `clockOffset` is
 * (server clock - client clock), so all clients count down to the same moment.
 */
export function useServerCountdown(deadline: number | null, clockOffset: number): number {
  const now = useNow(200, deadline !== null);
  if (deadline === null) return 0;
  return Math.max(0, deadline - (now + clockOffset));
}
