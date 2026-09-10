import { BASE_POINTS, MAX_SPEED_BONUS } from "../../../shared/constants";

/**
 * Server-side score for one answer.
 *
 *   correct:   BASE_POINTS + speed bonus (linear, MAX_SPEED_BONUS at 0 ms -> 0 at the deadline)
 *   incorrect: 0
 *
 * `elapsedMs` is measured by the server from the question start to when the
 * answer was received. Answers inside the latency grace window past the
 * deadline still earn base points but no bonus.
 */
export function calculatePoints(
  correct: boolean,
  elapsedMs: number,
  timeLimitMs: number,
): number {
  if (!correct) return 0;
  if (timeLimitMs <= 0) return BASE_POINTS;
  const clamped = Math.min(Math.max(elapsedMs, 0), timeLimitMs);
  const speedBonus = Math.round(MAX_SPEED_BONUS * (1 - clamped / timeLimitMs));
  return BASE_POINTS + speedBonus;
}
