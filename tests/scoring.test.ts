import { describe, expect, it } from "vitest";
import { BASE_POINTS, MAX_SPEED_BONUS } from "../shared/constants";
import { calculatePoints } from "../worker/src/game/scoring";

describe("calculatePoints", () => {
  const limit = 20_000;

  it("awards nothing for wrong answers", () => {
    expect(calculatePoints(false, 0, limit)).toBe(0);
  });

  it("awards base points plus a linear speed bonus", () => {
    expect(calculatePoints(true, 0, limit)).toBe(BASE_POINTS + MAX_SPEED_BONUS);
    expect(calculatePoints(true, limit / 2, limit)).toBe(BASE_POINTS + MAX_SPEED_BONUS / 2);
    expect(calculatePoints(true, limit, limit)).toBe(BASE_POINTS);
  });

  it("clamps elapsed time outside the question window", () => {
    expect(calculatePoints(true, -500, limit)).toBe(BASE_POINTS + MAX_SPEED_BONUS);
    expect(calculatePoints(true, limit + 400, limit)).toBe(BASE_POINTS);
  });
});
