/**
 * Pure, synchronous quiz engine. Every function takes the room state plus the
 * current server time, mutates the state in place, and returns the events
 * that should be broadcast. The Durable Object is a thin shell around this
 * module (persist + broadcast + schedule alarms), which keeps the business
 * rules unit-testable without the Workers runtime.
 */
import {
  ANSWER_GRACE_MS,
  EMPTY_ROOM_TTL_MS,
  IDLE_ROOM_TTL_MS,
  LEADER_HANDOFF_GRACE_MS,
  LOBBY_DISCONNECT_GRACE_MS,
  REVEAL_DURATION_HIDDEN_MS,
  REVEAL_DURATION_MS,
} from "../../../shared/constants";
import { RoomError } from "../../../shared/errors";
import type { RoomEvent } from "../../../shared/protocol";
import type {
  ClientRoomState,
  LeaderboardEntry,
  PublicPlayer,
  QuizSettings,
  RevealInfo,
} from "../../../shared/types";
import { nicknameKey, normalizeNickname, parseSettings } from "../../../shared/validation";
import { calculatePoints } from "./scoring";
import type { EngineDeps, PlayerRecord, RoomQuestion, RoomState } from "./types";

type IdDeps = Pick<EngineDeps, "generateId" | "generateToken">;

export interface JoinResult {
  player: PlayerRecord;
  events: RoomEvent[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function touch(state: RoomState, now: number): void {
  state.lastActivityAt = now;
}

function newPlayer(nickname: string, now: number, deps: IdDeps): PlayerRecord {
  return {
    id: deps.generateId(),
    nickname,
    sessionToken: deps.generateToken(),
    score: 0,
    correctAnswers: 0,
    joinedAt: now,
    connected: false,
    hasConnected: false,
    // Reserved seats count as "disconnected" until a socket attaches, so the
    // lobby grace period frees seats that are never claimed.
    disconnectedAt: now,
  };
}

export function sortedPlayers(state: RoomState): PlayerRecord[] {
  return Object.values(state.players).sort(
    (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id),
  );
}

function requirePlayer(state: RoomState, playerId: string): PlayerRecord {
  const player = state.players[playerId];
  if (!player) throw new RoomError("NOT_JOINED");
  return player;
}

function requireLeader(state: RoomState, playerId: string): PlayerRecord {
  const player = requirePlayer(state, playerId);
  if (state.leaderId !== playerId) throw new RoomError("NOT_LEADER");
  return player;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function resetProgress(state: RoomState): void {
  for (const player of Object.values(state.players)) {
    player.score = 0;
    player.correctAnswers = 0;
  }
  state.questions = [];
  state.currentQuestionIndex = -1;
  state.questionStartedAt = null;
  state.phaseEndsAt = null;
  state.answers = {};
}

/** Gives leadership to the earliest-joined remaining player (connected ones first). */
function assignNewLeader(state: RoomState): RoomEvent[] {
  const candidates = sortedPlayers(state).filter((p) => p.id !== state.leaderId);
  const next = candidates.find((p) => p.connected) ?? candidates[0];
  if (!next) return [];
  state.leaderId = next.id;
  return [{ type: "LEADER_CHANGED", playerId: next.id, nickname: next.nickname }];
}

/* ------------------------------------------------------------------ */
/* Room lifecycle                                                      */
/* ------------------------------------------------------------------ */

export function createRoom(params: {
  roomCode: string;
  nickname: string;
  settings: QuizSettings;
  now: number;
  deps: IdDeps;
}): { state: RoomState; leader: PlayerRecord } {
  const nickname = normalizeNickname(params.nickname);
  if (!nickname) throw new RoomError("INVALID_NICKNAME");
  const settings = parseSettings(params.settings);
  if (!settings) throw new RoomError("INVALID_SETTINGS");

  const leader = newPlayer(nickname, params.now, params.deps);
  const state: RoomState = {
    version: 1,
    roomCode: params.roomCode,
    createdAt: params.now,
    lastActivityAt: params.now,
    status: "LOBBY",
    leaderId: leader.id,
    settings,
    players: { [leader.id]: leader },
    questions: [],
    currentQuestionIndex: -1,
    questionStartedAt: null,
    phaseEndsAt: null,
    answers: {},
  };
  return { state, leader };
}

/** Reserves a seat for a new player (HTTP join). The socket attaches later. */
export function addPlayer(
  state: RoomState,
  rawNickname: unknown,
  now: number,
  deps: IdDeps,
): JoinResult {
  if (state.status === "ENDED") throw new RoomError("ROOM_NOT_FOUND");
  if (state.status !== "LOBBY" && !state.settings.allowLateJoin) {
    throw new RoomError("QUIZ_ALREADY_STARTED");
  }
  if (Object.keys(state.players).length >= state.settings.maxPlayers) {
    throw new RoomError("ROOM_FULL");
  }
  const nickname = normalizeNickname(rawNickname);
  if (!nickname) throw new RoomError("INVALID_NICKNAME");
  const key = nicknameKey(nickname);
  if (Object.values(state.players).some((p) => nicknameKey(p.nickname) === key)) {
    throw new RoomError("NICKNAME_TAKEN");
  }

  const player = newPlayer(nickname, now, deps);
  state.players[player.id] = player;
  if (!state.players[state.leaderId]) state.leaderId = player.id;
  touch(state, now);
  // PLAYER_JOINED is broadcast when the player's socket first connects.
  return { player, events: [] };
}

/** Attaches a WebSocket to an existing player via their secret session token. */
export function connectPlayer(state: RoomState, sessionToken: string, now: number): JoinResult {
  if (state.status === "ENDED") throw new RoomError("ROOM_NOT_FOUND");
  const player = Object.values(state.players).find((p) =>
    timingSafeEqual(p.sessionToken, sessionToken),
  );
  if (!player) throw new RoomError("INVALID_SESSION");

  const firstConnection = !player.hasConnected;
  player.connected = true;
  player.hasConnected = true;
  player.disconnectedAt = null;
  touch(state, now);

  const events: RoomEvent[] = firstConnection
    ? [{ type: "PLAYER_JOINED", playerId: player.id, nickname: player.nickname }]
    : [{ type: "ROOM_STATE" }];
  if (!state.players[state.leaderId]) {
    state.leaderId = player.id;
    events.push({ type: "LEADER_CHANGED", playerId: player.id, nickname: player.nickname });
  }
  return { player, events };
}

/** Socket dropped without LEAVE_ROOM: keep the player so they can reconnect. */
export function disconnectPlayer(state: RoomState, playerId: string, now: number): RoomEvent[] {
  const player = state.players[playerId];
  if (!player || !player.connected) return [];
  player.connected = false;
  player.disconnectedAt = now;
  touch(state, now);
  const reveal = maybeRevealEarly(state, now);
  return reveal.length > 0 ? reveal : [{ type: "ROOM_STATE" }];
}

/** Explicit leave (or lobby grace expiry): the player is removed from the room. */
export function removePlayer(state: RoomState, playerId: string, now: number): RoomEvent[] {
  const player = state.players[playerId];
  if (!player) return [];
  delete state.players[playerId];
  delete state.answers[playerId];
  touch(state, now);

  const events: RoomEvent[] = player.hasConnected
    ? [{ type: "PLAYER_LEFT", playerId, nickname: player.nickname }]
    : [{ type: "ROOM_STATE" }];
  if (state.leaderId === playerId) events.push(...assignNewLeader(state));
  events.push(...maybeRevealEarly(state, now));
  return events;
}

export function updateSettings(
  state: RoomState,
  playerId: string,
  settings: QuizSettings,
  now: number,
): RoomEvent[] {
  requireLeader(state, playerId);
  if (state.status !== "LOBBY") throw new RoomError("INVALID_STATE");
  const valid = parseSettings(settings);
  if (!valid) throw new RoomError("INVALID_SETTINGS");
  if (valid.maxPlayers < Object.keys(state.players).length) {
    throw new RoomError(
      "INVALID_SETTINGS",
      "Max players can't be lower than the number of players already in the room.",
    );
  }
  state.settings = valid;
  touch(state, now);
  return [{ type: "SETTINGS_UPDATED" }];
}

export function endRoom(state: RoomState, playerId: string, now: number): void {
  requireLeader(state, playerId);
  if (state.status === "ENDED") throw new RoomError("INVALID_STATE");
  state.status = "ENDED";
  state.phaseEndsAt = null;
  touch(state, now);
}

/* ------------------------------------------------------------------ */
/* Quiz flow                                                           */
/* ------------------------------------------------------------------ */

/** Cheap pre-check so we don't fetch questions for an unauthorized request. */
export function assertCanStartQuiz(state: RoomState, playerId: string): void {
  requireLeader(state, playerId);
  if (state.status !== "LOBBY") throw new RoomError("INVALID_STATE");
  if (!Object.values(state.players).some((p) => p.connected)) {
    throw new RoomError("NOT_ENOUGH_PLAYERS");
  }
}

export function startQuiz(
  state: RoomState,
  playerId: string,
  questions: RoomQuestion[],
  now: number,
): RoomEvent[] {
  assertCanStartQuiz(state, playerId);
  if (questions.length === 0) throw new RoomError("INTERNAL_ERROR");
  resetProgress(state);
  state.questions = questions;
  beginQuestion(state, 0, now);
  return [{ type: "QUIZ_STARTED" }];
}

function beginQuestion(state: RoomState, index: number, now: number): void {
  state.status = "QUESTION";
  state.currentQuestionIndex = index;
  state.questionStartedAt = now;
  state.phaseEndsAt = now + state.settings.timePerQuestion * 1000;
  state.answers = {};
  touch(state, now);
}

export function submitAnswer(
  state: RoomState,
  playerId: string,
  questionIndex: number,
  choiceIndex: number,
  now: number,
): RoomEvent[] {
  requirePlayer(state, playerId);
  if (state.status !== "QUESTION" || questionIndex !== state.currentQuestionIndex) {
    throw new RoomError("QUESTION_CLOSED");
  }
  if (state.phaseEndsAt !== null && now > state.phaseEndsAt + ANSWER_GRACE_MS) {
    throw new RoomError("QUESTION_CLOSED");
  }
  const question = state.questions[state.currentQuestionIndex];
  if (!question) throw new RoomError("INVALID_STATE");
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= question.choices.length) {
    throw new RoomError("INVALID_ANSWER");
  }
  if (state.answers[playerId]) throw new RoomError("ALREADY_ANSWERED");

  const elapsedMs = Math.max(0, now - (state.questionStartedAt ?? now));
  const correct = choiceIndex === question.correctIndex;
  state.answers[playerId] = {
    choiceIndex,
    correct,
    pointsAwarded: calculatePoints(correct, elapsedMs, state.settings.timePerQuestion * 1000),
    elapsedMs,
  };
  touch(state, now);

  const reveal = maybeRevealEarly(state, now);
  return reveal.length > 0 ? reveal : [{ type: "ANSWER_SUBMITTED", playerId }];
}

function allConnectedAnswered(state: RoomState): boolean {
  const connected = Object.values(state.players).filter((p) => p.connected);
  return connected.length > 0 && connected.every((p) => state.answers[p.id] !== undefined);
}

function maybeRevealEarly(state: RoomState, now: number): RoomEvent[] {
  return state.status === "QUESTION" && allConnectedAnswered(state)
    ? revealAnswer(state, now)
    : [];
}

/** Closes the question and applies pending points to player totals. */
function revealAnswer(state: RoomState, now: number): RoomEvent[] {
  for (const [playerId, answer] of Object.entries(state.answers)) {
    const player = state.players[playerId];
    if (!player) continue;
    player.score += answer.pointsAwarded;
    if (answer.correct) player.correctAnswers += 1;
  }
  state.status = "ANSWER_REVEAL";
  state.phaseEndsAt =
    now + (state.settings.showCorrectAnswer ? REVEAL_DURATION_MS : REVEAL_DURATION_HIDDEN_MS);
  touch(state, now);
  return [{ type: "ANSWER_REVEALED", questionIndex: state.currentQuestionIndex }];
}

function advance(state: RoomState, now: number): RoomEvent[] {
  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex < state.questions.length) {
    beginQuestion(state, nextIndex, now);
    return [{ type: "QUESTION_STARTED", questionIndex: nextIndex }];
  }
  state.status = "RESULTS";
  state.phaseEndsAt = null;
  state.questionStartedAt = null;
  state.answers = {};
  touch(state, now);
  return [{ type: "QUIZ_FINISHED" }];
}

/** Leader skip: closes an open question, or moves on from the reveal screen. */
export function nextQuestion(state: RoomState, playerId: string, now: number): RoomEvent[] {
  requireLeader(state, playerId);
  if (state.status === "QUESTION") return revealAnswer(state, now);
  if (state.status === "ANSWER_REVEAL") return advance(state, now);
  throw new RoomError("INVALID_STATE");
}

export function playAgain(state: RoomState, playerId: string, now: number): RoomEvent[] {
  requireLeader(state, playerId);
  if (state.status !== "RESULTS") throw new RoomError("INVALID_STATE");
  resetProgress(state);
  state.status = "LOBBY";
  touch(state, now);
  return [{ type: "QUIZ_RESET" }];
}

/* ------------------------------------------------------------------ */
/* Time-based transitions (driven by Durable Object alarms)            */
/* ------------------------------------------------------------------ */

export function roomExpiresAt(state: RoomState): number {
  const anyConnected = Object.values(state.players).some((p) => p.connected);
  return state.lastActivityAt + (anyConnected ? IDLE_ROOM_TTL_MS : EMPTY_ROOM_TTL_MS);
}

function leaderHandoffDeadline(state: RoomState): number | null {
  const leader = state.players[state.leaderId];
  if (!leader || leader.connected || leader.disconnectedAt === null) return null;
  const someoneElseConnected = Object.values(state.players).some(
    (p) => p.connected && p.id !== leader.id,
  );
  return someoneElseConnected ? leader.disconnectedAt + LEADER_HANDOFF_GRACE_MS : null;
}

export function tick(state: RoomState, now: number): { events: RoomEvent[]; expired: boolean } {
  if (state.status === "ENDED" || now >= roomExpiresAt(state)) {
    return { events: [], expired: true };
  }
  const events: RoomEvent[] = [];

  if (state.phaseEndsAt !== null && now >= state.phaseEndsAt) {
    if (state.status === "QUESTION") events.push(...revealAnswer(state, now));
    else if (state.status === "ANSWER_REVEAL") events.push(...advance(state, now));
  }

  if (state.status === "LOBBY") {
    for (const player of Object.values(state.players)) {
      if (
        !player.connected &&
        player.disconnectedAt !== null &&
        now >= player.disconnectedAt + LOBBY_DISCONNECT_GRACE_MS
      ) {
        events.push(...removePlayer(state, player.id, now));
      }
    }
  }

  const handoffAt = leaderHandoffDeadline(state);
  if (handoffAt !== null && now >= handoffAt) {
    const next = sortedPlayers(state).find((p) => p.connected && p.id !== state.leaderId);
    if (next) {
      state.leaderId = next.id;
      events.push({ type: "LEADER_CHANGED", playerId: next.id, nickname: next.nickname });
    }
  }

  return { events, expired: false };
}

/** Earliest moment `tick` has work to do. Never earlier than `now + 100ms`. */
export function nextAlarmTime(state: RoomState, now: number): number {
  const deadlines = [roomExpiresAt(state)];
  if (state.phaseEndsAt !== null) deadlines.push(state.phaseEndsAt);
  if (state.status === "LOBBY") {
    for (const player of Object.values(state.players)) {
      if (!player.connected && player.disconnectedAt !== null) {
        deadlines.push(player.disconnectedAt + LOBBY_DISCONNECT_GRACE_MS);
      }
    }
  }
  const handoffAt = leaderHandoffDeadline(state);
  if (handoffAt !== null) deadlines.push(handoffAt);
  return Math.max(Math.min(...deadlines), now + 100);
}

/* ------------------------------------------------------------------ */
/* Public projection                                                   */
/* ------------------------------------------------------------------ */

function questionsCompleted(state: RoomState): number {
  switch (state.status) {
    case "RESULTS":
      return state.questions.length;
    case "ANSWER_REVEAL":
      return state.currentQuestionIndex + 1;
    case "QUESTION":
      return state.currentQuestionIndex;
    default:
      return 0;
  }
}

export function buildLeaderboard(state: RoomState): LeaderboardEntry[] {
  const completed = questionsCompleted(state);
  const ranked = Object.values(state.players)
    .filter((p) => p.hasConnected)
    .sort(
      (a, b) =>
        b.score - a.score || b.correctAnswers - a.correctAnswers || a.joinedAt - b.joinedAt,
    );

  let rank = 0;
  return ranked.map((player, index) => {
    if (index === 0 || player.score !== ranked[index - 1]?.score) rank = index + 1;
    return {
      rank,
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      correctAnswers: player.correctAnswers,
      totalQuestions: completed,
      accuracy: completed > 0 ? Math.round((player.correctAnswers / completed) * 100) : 0,
      connected: player.connected,
    };
  });
}

/** Builds the snapshot one specific player is allowed to see. */
export function toClientState(state: RoomState, viewerId: string): ClientRoomState {
  const inQuestion = state.status === "QUESTION" || state.status === "ANSWER_REVEAL";
  const question = inQuestion ? state.questions[state.currentQuestionIndex] : undefined;
  const myAnswer = inQuestion ? state.answers[viewerId] : undefined;

  const players: PublicPlayer[] = sortedPlayers(state)
    .filter((p) => p.hasConnected)
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isLeader: p.id === state.leaderId,
      score: p.score,
      correctAnswers: p.correctAnswers,
      answered: inQuestion && state.answers[p.id] !== undefined,
      connected: p.connected,
      joinedAt: p.joinedAt,
    }));

  let reveal: RevealInfo | null = null;
  if (state.status === "ANSWER_REVEAL" && question) {
    if (state.settings.showCorrectAnswer) {
      const choiceCounts = question.choices.map(() => 0);
      for (const answer of Object.values(state.answers)) {
        choiceCounts[answer.choiceIndex] = (choiceCounts[answer.choiceIndex] ?? 0) + 1;
      }
      reveal = {
        correctIndex: question.correctIndex,
        choiceCounts,
        myResult: {
          choiceIndex: myAnswer?.choiceIndex ?? null,
          correct: myAnswer?.correct ?? false,
          pointsAwarded: myAnswer?.pointsAwarded ?? 0,
        },
      };
    } else {
      reveal = { correctIndex: null, choiceCounts: null, myResult: null };
    }
  }

  return {
    roomCode: state.roomCode,
    status: state.status,
    settings: state.settings,
    leaderId: state.leaderId,
    players,
    me: { playerId: viewerId, isLeader: viewerId === state.leaderId },
    questionIndex: state.status === "LOBBY" ? -1 : state.currentQuestionIndex,
    totalQuestions: state.questions.length || state.settings.questionCount,
    question: question
      ? {
          id: question.id,
          text: question.text,
          choices: question.choices,
          category: question.category,
          difficulty: question.difficulty,
        }
      : null,
    questionStartedAt: inQuestion ? state.questionStartedAt : null,
    phaseEndsAt: state.phaseEndsAt,
    myAnswer: myAnswer?.choiceIndex ?? null,
    answeredCount: inQuestion ? Object.keys(state.answers).length : 0,
    reveal,
    leaderboard: buildLeaderboard(state),
  };
}
