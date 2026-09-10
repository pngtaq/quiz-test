import { DEFAULT_SETTINGS } from "../shared/constants";
import type { QuizSettings } from "../shared/types";
import { addPlayer, connectPlayer, createRoom } from "../worker/src/game/engine";
import type { EngineDeps, PlayerRecord, RoomQuestion, RoomState } from "../worker/src/game/types";

export const T0 = 1_700_000_000_000;

/** Deterministic PRNG (mulberry32) so shuffles are reproducible in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function testDeps(): EngineDeps {
  let ids = 0;
  let tokens = 0;
  return {
    random: seededRandom(42),
    generateId: () => `player-${++ids}`,
    generateToken: () => `token_${String(++tokens).padStart(40, "0")}`,
  };
}

/** Questions whose correct answer is choice `i % 4`. */
export function makeQuestions(count: number): RoomQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i}`,
    text: `Question ${i + 1}`,
    choices: ["A", "B", "C", "D"],
    correctIndex: i % 4,
    category: "general" as const,
    difficulty: "easy" as const,
  }));
}

export interface TestRoom {
  state: RoomState;
  leader: PlayerRecord;
  deps: EngineDeps;
}

/** A lobby room whose leader "Raison" is already connected. */
export function setupRoom(overrides: Partial<QuizSettings> = {}): TestRoom {
  const deps = testDeps();
  const { state, leader } = createRoom({
    roomCode: "AB7KQ",
    nickname: "Raison",
    settings: { ...DEFAULT_SETTINGS, ...overrides },
    now: T0,
    deps,
  });
  connectPlayer(state, leader.sessionToken, T0);
  return { state, leader, deps };
}

export function joinAndConnect(room: TestRoom, nickname: string, now = T0): PlayerRecord {
  const { player } = addPlayer(room.state, nickname, now, room.deps);
  connectPlayer(room.state, player.sessionToken, now);
  return player;
}
