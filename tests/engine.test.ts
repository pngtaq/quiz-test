import { describe, expect, it } from "vitest";
import {
  ANSWER_GRACE_MS,
  EMPTY_ROOM_TTL_MS,
  LEADER_HANDOFF_GRACE_MS,
  LOBBY_DISCONNECT_GRACE_MS,
  REVEAL_DURATION_MS,
} from "../shared/constants";
import { RoomError } from "../shared/errors";
import type { ErrorCode } from "../shared/types";
import {
  addPlayer,
  connectPlayer,
  createRoom,
  disconnectPlayer,
  endRoom,
  nextAlarmTime,
  nextQuestion,
  playAgain,
  removePlayer,
  startQuiz,
  submitAnswer,
  tick,
  toClientState,
  updateSettings,
} from "../worker/src/game/engine";
import { T0, joinAndConnect, makeQuestions, setupRoom, testDeps } from "./helpers";

function expectRoomError(fn: () => unknown, code: ErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(RoomError);
    expect((error as RoomError).code).toBe(code);
    return;
  }
  throw new Error(`Expected RoomError ${code}, but nothing was thrown`);
}

const TIME_LIMIT_MS = 20_000; // DEFAULT_SETTINGS.timePerQuestion

describe("room creation", () => {
  it("creates a lobby with the creator as leader", () => {
    const { state } = createRoom({
      roomCode: "AB7KQ",
      nickname: "  Raison  ",
      settings: setupRoom().state.settings,
      now: T0,
      deps: testDeps(),
    });
    const leader = state.players[state.leaderId];
    expect(state.status).toBe("LOBBY");
    expect(state.roomCode).toBe("AB7KQ");
    expect(leader?.nickname).toBe("Raison");
    expect(state.currentQuestionIndex).toBe(-1);
  });

  it("rejects invalid nicknames and settings", () => {
    const { settings } = setupRoom().state;
    const base = { roomCode: "AB7KQ", now: T0, deps: testDeps() };
    expectRoomError(() => createRoom({ ...base, nickname: "   ", settings }), "INVALID_NICKNAME");
    expectRoomError(
      () => createRoom({ ...base, nickname: "Raison", settings: { ...settings, questionCount: 7 } }),
      "INVALID_SETTINGS",
    );
  });

  it("never exposes session tokens in client snapshots", () => {
    const room = setupRoom();
    const guest = joinAndConnect(room, "John");
    const snapshot = JSON.stringify(toClientState(room.state, guest.id));
    expect(snapshot).not.toContain(room.leader.sessionToken);
    expect(snapshot).not.toContain(guest.sessionToken);
  });
});

describe("joining", () => {
  it("shows a player only after their socket connects", () => {
    const room = setupRoom();
    const { player } = addPlayer(room.state, "John", T0, room.deps);
    expect(toClientState(room.state, room.leader.id).players).toHaveLength(1);

    const { events } = connectPlayer(room.state, player.sessionToken, T0 + 10);
    expect(events).toEqual([{ type: "PLAYER_JOINED", playerId: player.id, nickname: "John" }]);
    expect(toClientState(room.state, room.leader.id).players.map((p) => p.nickname)).toEqual([
      "Raison",
      "John",
    ]);
  });

  it("rejects duplicate nicknames case-insensitively", () => {
    const room = setupRoom();
    joinAndConnect(room, "John");
    expectRoomError(() => addPlayer(room.state, "john", T0, room.deps), "NICKNAME_TAKEN");
    expectRoomError(() => addPlayer(room.state, " JOHN ", T0, room.deps), "NICKNAME_TAKEN");
  });

  it("enforces room capacity", () => {
    const room = setupRoom({ maxPlayers: 2 });
    joinAndConnect(room, "John");
    expectRoomError(() => addPlayer(room.state, "Mark", T0, room.deps), "ROOM_FULL");
  });

  it("blocks joining after the quiz starts unless late joining is allowed", () => {
    const closed = setupRoom();
    startQuiz(closed.state, closed.leader.id, makeQuestions(5), T0);
    expectRoomError(() => addPlayer(closed.state, "John", T0, closed.deps), "QUIZ_ALREADY_STARTED");

    const open = setupRoom({ allowLateJoin: true });
    startQuiz(open.state, open.leader.id, makeQuestions(5), T0);
    expect(() => addPlayer(open.state, "John", T0, open.deps)).not.toThrow();
  });

  it("rejects unknown session tokens", () => {
    const room = setupRoom();
    expectRoomError(
      () => connectPlayer(room.state, "token_does_not_exist_000000000000000", T0),
      "INVALID_SESSION",
    );
  });

  it("restores the same player on reconnect without duplicating them", () => {
    const room = setupRoom();
    const guest = joinAndConnect(room, "John");
    disconnectPlayer(room.state, guest.id, T0 + 1_000);
    expect(room.state.players[guest.id]?.connected).toBe(false);

    const { player, events } = connectPlayer(room.state, guest.sessionToken, T0 + 2_000);
    expect(player.id).toBe(guest.id);
    expect(events).toEqual([{ type: "ROOM_STATE" }]);
    expect(Object.keys(room.state.players)).toHaveLength(2);
    expect(room.state.players[guest.id]?.connected).toBe(true);
  });
});

describe("leader authorization", () => {
  it("only lets the leader control the room", () => {
    const room = setupRoom();
    const guest = joinAndConnect(room, "John");
    const { state } = room;

    expectRoomError(() => startQuiz(state, guest.id, makeQuestions(5), T0), "NOT_LEADER");
    expectRoomError(() => updateSettings(state, guest.id, state.settings, T0), "NOT_LEADER");
    expectRoomError(() => endRoom(state, guest.id, T0), "NOT_LEADER");

    startQuiz(state, room.leader.id, makeQuestions(5), T0);
    expectRoomError(() => nextQuestion(state, guest.id, T0), "NOT_LEADER");
  });

  it("syncs settings changes from the leader and validates capacity", () => {
    const room = setupRoom();
    joinAndConnect(room, "John");
    joinAndConnect(room, "Mark");
    const events = updateSettings(
      room.state,
      room.leader.id,
      { ...room.state.settings, category: "science" },
      T0,
    );
    expect(events).toEqual([{ type: "SETTINGS_UPDATED" }]);
    expect(room.state.settings.category).toBe("science");
    expectRoomError(
      () => updateSettings(room.state, room.leader.id, { ...room.state.settings, maxPlayers: 2 }, T0),
      "INVALID_SETTINGS",
    );
  });

  it("hands leadership to the next player when the leader leaves", () => {
    const room = setupRoom();
    const john = joinAndConnect(room, "John", T0 + 1);
    joinAndConnect(room, "Mark", T0 + 2);
    const events = removePlayer(room.state, room.leader.id, T0 + 10);
    expect(events).toContainEqual({ type: "LEADER_CHANGED", playerId: john.id, nickname: "John" });
    expect(room.state.leaderId).toBe(john.id);
  });

  it("hands leadership over when the leader stays disconnected", () => {
    const room = setupRoom();
    const john = joinAndConnect(room, "John", T0 + 1);
    startQuiz(room.state, room.leader.id, makeQuestions(5), T0 + 5);
    disconnectPlayer(room.state, room.leader.id, T0 + 10);

    expect(tick(room.state, T0 + 10 + LEADER_HANDOFF_GRACE_MS - 1).events).not.toContainEqual(
      expect.objectContaining({ type: "LEADER_CHANGED" }),
    );
    const { events } = tick(room.state, T0 + 10 + LEADER_HANDOFF_GRACE_MS);
    expect(events).toContainEqual({ type: "LEADER_CHANGED", playerId: john.id, nickname: "John" });
  });
});

describe("answering and scoring", () => {
  it("scores answers server-side and applies points only at reveal", () => {
    const room = setupRoom();
    const john = joinAndConnect(room, "John");
    startQuiz(room.state, room.leader.id, makeQuestions(3), T0);

    // Question 0: correct choice is 0.
    submitAnswer(room.state, room.leader.id, 0, 0, T0); // instant, correct
    expect(room.state.players[room.leader.id]?.score).toBe(0); // hidden until reveal
    expect(toClientState(room.state, john.id).leaderboard[0]?.score).toBe(0);

    submitAnswer(room.state, john.id, 0, 2, T0 + TIME_LIMIT_MS / 2); // wrong
    expect(room.state.status).toBe("ANSWER_REVEAL");
    expect(room.state.players[room.leader.id]?.score).toBe(1500);
    expect(room.state.players[room.leader.id]?.correctAnswers).toBe(1);
    expect(room.state.players[john.id]?.score).toBe(0);
  });

  it("rejects multiple answers to the same question", () => {
    const room = setupRoom();
    joinAndConnect(room, "John");
    startQuiz(room.state, room.leader.id, makeQuestions(3), T0);
    submitAnswer(room.state, room.leader.id, 0, 1, T0 + 100);
    expectRoomError(() => submitAnswer(room.state, room.leader.id, 0, 0, T0 + 200), "ALREADY_ANSWERED");
  });

  it("validates choice index and question index", () => {
    const room = setupRoom();
    startQuiz(room.state, room.leader.id, makeQuestions(3), T0);
    expectRoomError(() => submitAnswer(room.state, room.leader.id, 0, 4, T0), "INVALID_ANSWER");
    expectRoomError(() => submitAnswer(room.state, room.leader.id, 1, 0, T0), "QUESTION_CLOSED");
  });

  it("rejects answers after the question has ended", () => {
    const room = setupRoom();
    joinAndConnect(room, "John");
    startQuiz(room.state, room.leader.id, makeQuestions(3), T0);

    const late = T0 + TIME_LIMIT_MS + ANSWER_GRACE_MS + 1;
    expectRoomError(() => submitAnswer(room.state, room.leader.id, 0, 0, late), "QUESTION_CLOSED");

    tick(room.state, T0 + TIME_LIMIT_MS);
    expect(room.state.status).toBe("ANSWER_REVEAL");
    expectRoomError(() => submitAnswer(room.state, room.leader.id, 0, 0, T0 + 1), "QUESTION_CLOSED");
  });

  it("does not reveal the correct answer before the reveal phase", () => {
    const room = setupRoom();
    const john = joinAndConnect(room, "John");
    startQuiz(room.state, room.leader.id, makeQuestions(3), T0);
    submitAnswer(room.state, room.leader.id, 0, 0, T0);

    const snapshot = toClientState(room.state, john.id);
    expect(snapshot.reveal).toBeNull();
    expect(snapshot.question).not.toHaveProperty("correctIndex");
    expect(snapshot.players.find((p) => p.id === room.leader.id)?.answered).toBe(true);

    tick(room.state, T0 + TIME_LIMIT_MS);
    const revealed = toClientState(room.state, john.id);
    expect(revealed.reveal?.correctIndex).toBe(0);
    expect(revealed.reveal?.choiceCounts).toEqual([1, 0, 0, 0]);
    expect(revealed.reveal?.myResult).toEqual({ choiceIndex: null, correct: false, pointsAwarded: 0 });
  });

  it("hides answers between questions when showCorrectAnswer is off", () => {
    const room = setupRoom({ showCorrectAnswer: false });
    startQuiz(room.state, room.leader.id, makeQuestions(3), T0);
    submitAnswer(room.state, room.leader.id, 0, 0, T0);
    expect(toClientState(room.state, room.leader.id).reveal).toEqual({
      correctIndex: null,
      choiceCounts: null,
      myResult: null,
    });
  });
});

describe("question progression", () => {
  it("reveals early once every connected player has answered", () => {
    const room = setupRoom();
    const john = joinAndConnect(room, "John");
    const mark = joinAndConnect(room, "Mark");
    startQuiz(room.state, room.leader.id, makeQuestions(3), T0);
    disconnectPlayer(room.state, mark.id, T0 + 1);

    expect(submitAnswer(room.state, room.leader.id, 0, 0, T0 + 100)).toEqual([
      { type: "ANSWER_SUBMITTED", playerId: room.leader.id },
    ]);
    expect(submitAnswer(room.state, john.id, 0, 1, T0 + 200)).toEqual([
      { type: "ANSWER_REVEALED", questionIndex: 0 },
    ]);
  });

  it("advances on timers: question -> reveal -> next question", () => {
    const room = setupRoom();
    startQuiz(room.state, room.leader.id, makeQuestions(3), T0);
    expect(nextAlarmTime(room.state, T0)).toBe(T0 + TIME_LIMIT_MS);

    expect(tick(room.state, T0 + TIME_LIMIT_MS - 1).events).toEqual([]);
    expect(tick(room.state, T0 + TIME_LIMIT_MS).events).toEqual([
      { type: "ANSWER_REVEALED", questionIndex: 0 },
    ]);
    const revealEnd = T0 + TIME_LIMIT_MS + REVEAL_DURATION_MS;
    expect(tick(room.state, revealEnd).events).toEqual([{ type: "QUESTION_STARTED", questionIndex: 1 }]);
    expect(room.state.currentQuestionIndex).toBe(1);
    expect(room.state.phaseEndsAt).toBe(revealEnd + TIME_LIMIT_MS);
  });

  it("lets the leader skip ahead", () => {
    const room = setupRoom();
    startQuiz(room.state, room.leader.id, makeQuestions(2), T0);
    expect(nextQuestion(room.state, room.leader.id, T0 + 1)).toEqual([
      { type: "ANSWER_REVEALED", questionIndex: 0 },
    ]);
    expect(nextQuestion(room.state, room.leader.id, T0 + 2)).toEqual([
      { type: "QUESTION_STARTED", questionIndex: 1 },
    ]);
  });

  it("completes the quiz with a ranked final leaderboard", () => {
    const room = setupRoom();
    const john = joinAndConnect(room, "John", T0 + 1);
    const sarah = joinAndConnect(room, "Sarah", T0 + 2);
    startQuiz(room.state, room.leader.id, makeQuestions(2), T0 + 10);

    let now = T0 + 10;
    for (let q = 0; q < 2; q++) {
      const correct = q % 4;
      submitAnswer(room.state, room.leader.id, q, correct, now); // always right, instant
      submitAnswer(room.state, john.id, q, q === 0 ? correct : (correct + 1) % 4, now); // 1 of 2
      submitAnswer(room.state, sarah.id, q, (correct + 1) % 4, now); // always wrong
      now += 1;
      const events = nextQuestion(room.state, room.leader.id, now);
      if (q === 1) expect(events).toEqual([{ type: "QUIZ_FINISHED" }]);
    }

    expect(room.state.status).toBe("RESULTS");
    const board = toClientState(room.state, sarah.id).leaderboard;
    expect(board.map((e) => [e.rank, e.nickname, e.score, e.correctAnswers, e.accuracy])).toEqual([
      [1, "Raison", 3000, 2, 100],
      [2, "John", 1500, 1, 50],
      [3, "Sarah", 0, 0, 0],
    ]);
    expect(board.every((e) => e.totalQuestions === 2)).toBe(true);
  });

  it("resets to the lobby on play again", () => {
    const room = setupRoom();
    startQuiz(room.state, room.leader.id, makeQuestions(1), T0);
    submitAnswer(room.state, room.leader.id, 0, 0, T0);
    nextQuestion(room.state, room.leader.id, T0 + 1);
    expect(room.state.status).toBe("RESULTS");

    expect(playAgain(room.state, room.leader.id, T0 + 2)).toEqual([{ type: "QUIZ_RESET" }]);
    expect(room.state.status).toBe("LOBBY");
    expect(room.state.players[room.leader.id]?.score).toBe(0);
    expect(room.state.questions).toEqual([]);
  });
});

describe("disconnects and expiry", () => {
  it("removes lobby players who don't reconnect within the grace period", () => {
    const room = setupRoom();
    const john = joinAndConnect(room, "John");
    disconnectPlayer(room.state, john.id, T0 + 1_000);

    tick(room.state, T0 + 1_000 + LOBBY_DISCONNECT_GRACE_MS - 1);
    expect(room.state.players[john.id]).toBeDefined();

    const { events } = tick(room.state, T0 + 1_000 + LOBBY_DISCONNECT_GRACE_MS);
    expect(events).toContainEqual({ type: "PLAYER_LEFT", playerId: john.id, nickname: "John" });
    expect(room.state.players[john.id]).toBeUndefined();
  });

  it("keeps disconnected players during a quiz so they can rejoin", () => {
    const room = setupRoom();
    const john = joinAndConnect(room, "John");
    startQuiz(room.state, room.leader.id, makeQuestions(5), T0);
    disconnectPlayer(room.state, john.id, T0 + 1);
    tick(room.state, T0 + 1 + LOBBY_DISCONNECT_GRACE_MS * 2);
    expect(room.state.players[john.id]).toBeDefined();
  });

  it("expires rooms that nobody is connected to", () => {
    const room = setupRoom();
    disconnectPlayer(room.state, room.leader.id, T0 + 5);
    expect(tick(room.state, T0 + 5 + EMPTY_ROOM_TTL_MS - 1).expired).toBe(false);
    // The lobby grace removed the leader, which counts as activity.
    const lastActivity = room.state.lastActivityAt;
    expect(tick(room.state, lastActivity + EMPTY_ROOM_TTL_MS).expired).toBe(true);
  });
});
