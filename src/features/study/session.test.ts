import { describe, expect, it } from "vitest";
import { createDefaultProfile } from "../../domain/study";
import type { SavedSession, StudyConfig } from "../../domain/types";
import {
  advanceSession,
  assertSessionCheckpoint,
  createSession,
  questionRandom,
} from "./session";

const config: StudyConfig = {
  mode: "quiz",
  keys: ["kanji:19968", "kanji:20108"],
  title: "Numbers",
  size: 2,
  shuffle: false,
  repeatMistakes: true,
  prompt: "meaning",
  writingMode: "guided",
  guided: false,
};

describe("study session lifecycle", () => {
  it("rejects stale checkpoints after another tab advances, completes, or starts a session", () => {
    const current = createSession(config, createDefaultProfile(), 100, "first");
    expect(() =>
      assertSessionCheckpoint(structuredClone(current), current),
    ).not.toThrow();
    expect(() =>
      assertSessionCheckpoint(advanceSession(current, true), current),
    ).toThrow("changed in another tab");
    expect(() => assertSessionCheckpoint(null, current)).toThrow(
      "changed in another tab",
    );
    const replacement = createSession(
      config,
      createDefaultProfile(),
      200,
      "second",
    );
    expect(() => assertSessionCheckpoint(replacement, current)).toThrow(
      "changed in another tab",
    );
    expect(() => assertSessionCheckpoint(replacement, null)).toThrow(
      "changed in another tab",
    );
    expect(() => assertSessionCheckpoint(null, null)).not.toThrow();
  });
  it("resumes the persisted queue and score instead of reshuffling", () => {
    const profile = createDefaultProfile();
    const existing: SavedSession = {
      config,
      sessionId: "old",
      queue: [...config.keys].reverse(),
      index: 1,
      correct: 1,
      answers: 1,
      startedAt: 123,
      mistakes: [],
    };
    profile.savedSession = existing;
    expect(createSession(config, profile, 500, "new")).toEqual(existing);
  });
  it("repeats a missed item once and keeps the result queue bounded", () => {
    const original = createSession(
      config,
      createDefaultProfile(),
      1,
      "session",
    );
    const missed = advanceSession(original, false);
    expect(missed.queue).toEqual(["kanji:19968", "kanji:20108", "kanji:19968"]);
    const next = advanceSession(missed, true);
    const repeated = advanceSession(next, false);
    expect(repeated.queue).toHaveLength(3);
    expect(repeated.index).toBe(3);
    expect(repeated.mistakes).toEqual(["kanji:19968"]);
    expect(repeated.correct).toBe(1);
    expect(original.index).toBe(0);
  });
  it("does not penalize an entry without reading content", () => {
    const original = createSession(
      config,
      createDefaultProfile(),
      1,
      "session",
    );
    const skipped = advanceSession(original, false, true);
    expect(skipped.answers).toBe(0);
    expect(skipped.index).toBe(1);
    expect(skipped.queue).toHaveLength(2);
  });
  it("keeps randomized answer choices stable for a session encounter", () => {
    const a = questionRandom("session:2");
    const b = questionRandom("session:2");
    expect(Array.from({ length: 10 }, a)).toEqual(
      Array.from({ length: 10 }, b),
    );
  });
});
