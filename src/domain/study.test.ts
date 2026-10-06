import { describe, expect, it } from "vitest";
import {
  createDefaultProfile,
  getDailyNewAllowance,
  localDayKey,
  makeStudyQueue,
  recordStudy,
  scheduleReview,
  statistics,
} from "./study";
import type { CharacterKey, StudyEvent } from "./types";

const now = new Date(2026, 9, 7, 12).getTime();
const event = (id: string, extra: Partial<StudyEvent> = {}): StudyEvent => ({
  id,
  key: "kanji:23398",
  mode: "quiz",
  correct: true,
  durationMs: 1_200,
  at: now,
  ...extra,
});

describe("review scheduling", () => {
  it("uses explicit initial intervals and grows successful reviews", () => {
    const first = scheduleReview(null, 2, now);
    expect(first.interval).toBe(1);
    expect(first.due).toBe(now + 86_400_000);
    const second = scheduleReview(first, 2, first.due);
    expect(second.interval).toBe(3);
    expect(scheduleReview(second, 2, second.due).interval).toBe(8);
    expect(scheduleReview(null, 3, now).interval).toBe(4);
  });

  it("reschedules a lapse for ten minutes and bounds ease", () => {
    const previous = {
      due: now,
      interval: 30,
      repetitions: 8,
      lapses: 2,
      ease: 1.3,
    };
    const again = scheduleReview(previous, 0, now);
    expect(again).toEqual({
      due: now + 600_000,
      interval: 10 / 1_440,
      repetitions: 0,
      lapses: 3,
      ease: 1.3,
    });
    expect(scheduleReview(again, 1, now).interval).toBe(1);
    expect(previous.repetitions).toBe(8);
    expect(scheduleReview({ ...previous, ease: 3 }, 3, now).ease).toBe(3);
  });
});

describe("study results", () => {
  it("starts with no inherited statistics and records an event exactly once", () => {
    const profile = createDefaultProfile();
    expect(profile.events).toEqual([]);
    expect(profile.progress).toEqual({});
    recordStudy(profile, event("answer-1"));
    recordStudy(profile, event("answer-1"));
    expect(profile.events).toHaveLength(1);
    expect(profile.progress["kanji:23398"]).toMatchObject({
      reviews: 1,
      correct: 1,
      rating: 1,
      timeMs: 1_200,
    });
  });

  it("keeps writing metrics and kind-specific identities independent", () => {
    const profile = createDefaultProfile();
    recordStudy(
      profile,
      event("write-1", { mode: "writing", correct: false, rating: 2 }),
      0,
    );
    recordStudy(
      profile,
      event("radical-1", { key: "radical:23398", rating: 3 }),
    );
    expect(profile.progress["kanji:23398"]).toMatchObject({
      writingAttempts: 1,
      writingCorrect: 0,
      correct: 0,
      rating: 2,
    });
    expect(profile.progress["radical:23398"]).toMatchObject({
      reviews: 1,
      rating: 3,
    });
    expect(profile.progress["kanji:23398"]?.srs?.due).toBe(now + 600_000);
  });

  it("creates unique bounded queues without mutating the input", () => {
    const keys: CharacterKey[] = ["kanji:1", "kanji:2", "kanji:2", "radical:1"];
    expect(makeStudyQueue(keys, 2, false)).toEqual(["kanji:1", "kanji:2"]);
    expect(makeStudyQueue(keys, 20, true, () => 0)).toEqual([
      "kanji:2",
      "radical:1",
      "kanji:1",
    ]);
    expect(keys).toHaveLength(4);
    expect(makeStudyQueue(keys, 0, true)).toEqual([]);
  });
});

describe("statistics", () => {
  it("shares the new-character allowance across sessions without charging repeated reviews", () => {
    const profile = createDefaultProfile();
    profile.settings.newPerDay = 2;
    recordStudy(
      profile,
      event("old", { at: new Date(2026, 9, 6, 12).getTime() }),
    );
    recordStudy(profile, event("repeat-old"));
    expect(getDailyNewAllowance(profile, now)).toBe(2);
    recordStudy(profile, event("new", { key: "kanji:134047" }));
    recordStudy(profile, event("repeat-new", { key: "kanji:134047" }));
    expect(getDailyNewAllowance(profile, now)).toBe(1);
    recordStudy(profile, event("new-radical", { key: "radical:23398" }));
    expect(getDailyNewAllowance(profile, now)).toBe(0);
    expect(
      getDailyNewAllowance(profile, new Date(2026, 9, 8, 12).getTime()),
    ).toBe(2);
  });

  it("aggregates reviews and a streak continuing from yesterday", () => {
    const profile = createDefaultProfile();
    const yesterday = new Date(2026, 9, 6, 12).getTime();
    const dayBefore = new Date(2026, 9, 5, 12).getTime();
    recordStudy(profile, event("1", { at: yesterday, rating: 3 }));
    recordStudy(
      profile,
      event("2", { at: dayBefore, correct: false, mode: "writing" }),
    );
    const result = statistics(profile, now);
    expect(result).toMatchObject({
      todayReviews: 0,
      totalReviews: 2,
      totalCorrect: 1,
      accuracy: 50,
      streak: 2,
      learned: 1,
    });
    expect(result.modeCounts).toEqual({
      quiz: 1,
      writing: 1,
      flashcards: 0,
      reading: 0,
    });
    expect(result.last7Days.at(-1)).toEqual({
      day: localDayKey(now),
      reviews: 0,
      correct: 0,
      timeMs: 0,
    });
    recordStudy(profile, event("3"));
    expect(statistics(profile, now)).toMatchObject({
      todayReviews: 1,
      todayTimeMs: 1_200,
      streak: 3,
    });
  });
});
