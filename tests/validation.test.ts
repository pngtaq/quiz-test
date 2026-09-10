import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, ROOM_CODE_ALPHABET } from "../shared/constants";
import {
  isValidRoomCode,
  normalizeNickname,
  normalizeRoomCode,
  parseClientMessage,
  parseSettings,
} from "../shared/validation";
import { generateRoomCode, generateToken } from "../worker/src/lib/random";

describe("room codes", () => {
  it("normalizes and validates codes", () => {
    expect(normalizeRoomCode(" ab7 kq ")).toBe("AB7KQ");
    expect(isValidRoomCode("AB7KQ")).toBe(true);
    expect(isValidRoomCode("AB7K")).toBe(false);
    expect(isValidRoomCode("AB0KQ")).toBe(false); // 0 is excluded (ambiguous)
    expect(isValidRoomCode("ab7kq")).toBe(false);
  });

  it("generates valid codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(isValidRoomCode(code)).toBe(true);
      for (const char of code) expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });
});

describe("nicknames", () => {
  it("trims, collapses whitespace and strips control characters", () => {
    expect(normalizeNickname("  Sarah   Lee ")).toBe("Sarah Lee");
    expect(normalizeNickname("Al\u0000ex")).toBe("Alex");
  });

  it("rejects empty, non-string and too-long nicknames", () => {
    expect(normalizeNickname("   ")).toBeNull();
    expect(normalizeNickname(42)).toBeNull();
    expect(normalizeNickname("x".repeat(21))).toBeNull();
    expect(normalizeNickname("x".repeat(20))).toBe("x".repeat(20));
  });
});

describe("settings", () => {
  it("accepts defaults and rejects out-of-range values", () => {
    expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ ...DEFAULT_SETTINGS, timePerQuestion: 5 })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, category: "cooking" })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, allowLateJoin: "yes" })).toBeNull();
  });

  it("drops unknown keys", () => {
    const parsed = parseSettings({ ...DEFAULT_SETTINGS, isAdmin: true });
    expect(parsed).not.toHaveProperty("isAdmin");
  });
});

describe("parseClientMessage", () => {
  it("accepts well-formed messages", () => {
    const token = generateToken();
    expect(parseClientMessage(JSON.stringify({ type: "JOIN_ROOM", sessionToken: token }))).toEqual({
      type: "JOIN_ROOM",
      sessionToken: token,
    });
    expect(
      parseClientMessage(JSON.stringify({ type: "SUBMIT_ANSWER", questionIndex: 2, choiceIndex: 1 })),
    ).toEqual({ type: "SUBMIT_ANSWER", questionIndex: 2, choiceIndex: 1 });
    expect(parseClientMessage('{"type":"START_QUIZ","isLeader":true}')).toEqual({ type: "START_QUIZ" });
  });

  it("rejects malformed or unexpected input", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage(new ArrayBuffer(4))).toBeNull();
    expect(parseClientMessage('{"type":"GIVE_ME_POINTS"}')).toBeNull();
    expect(parseClientMessage('{"type":"JOIN_ROOM","sessionToken":"short"}')).toBeNull();
    expect(parseClientMessage('{"type":"SUBMIT_ANSWER","questionIndex":0,"choiceIndex":-1}')).toBeNull();
    expect(parseClientMessage('{"type":"SUBMIT_ANSWER","questionIndex":0,"choiceIndex":1.5}')).toBeNull();
    expect(parseClientMessage("x".repeat(5000))).toBeNull();
  });
});
