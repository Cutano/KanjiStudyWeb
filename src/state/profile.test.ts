import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultProfile, recordStudy } from "../domain/study";
import type { ExtensionPack, UserProfile } from "../domain/types";
import {
  exportBackup,
  getProfile,
  importBackup,
  importExtension,
  initializeProfile,
  subscribeProfile,
  updateProfile,
} from "./profile";
import { parseBackup, validateProfile } from "./validation";

function backup(profile: UserProfile = createDefaultProfile()) {
  return JSON.stringify({ app: "kanji-study-web", schemaVersion: 1, profile });
}

beforeEach(async () => {
  await initializeProfile();
  await importBackup(backup());
});

describe("durable profile transactions", () => {
  it("serializes concurrent updates and reads the latest stored record", async () => {
    await Promise.all([
      updateProfile((draft) => {
        draft.notes["kanji:23398"] = "Learn";
      }),
      updateProfile((draft) => {
        draft.favorites.push("kanji:134047");
      }),
    ]);
    expect(getProfile().notes["kanji:23398"]).toBe("Learn");
    expect(getProfile().favorites).toEqual(["kanji:134047"]);
    const db = await openDB("kanji-study-web", 1);
    const external = (await db.get("profile", "current")) as UserProfile;
    external.settings.dailyGoal = 50;
    await db.put("profile", external, "current");
    await updateProfile((draft) => {
      draft.notes["radical:23398"] = "Independent";
    });
    expect(getProfile().settings.dailyGoal).toBe(50);
    expect(
      ((await db.get("profile", "current")) as UserProfile).notes[
        "radical:23398"
      ],
    ).toBe("Independent");
    db.close();
  });

  it("does not publish an aborted update and remains usable afterward", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeProfile(listener);
    await expect(
      updateProfile((draft) => {
        draft.notes["kanji:23398"] = "Must not persist";
        throw new Error("Stop transaction");
      }),
    ).rejects.toThrow("Stop transaction");
    expect(getProfile().notes).toEqual({});
    expect(listener).not.toHaveBeenCalled();
    await updateProfile((draft) => {
      draft.settings.dailyGoal = 30;
    });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("atomically commits an answer and its session advancement", async () => {
    await updateProfile((draft) => {
      draft.savedSession = {
        sessionId: "stable-session",
        mistakes: ["kanji:23398"],
        config: {
          keys: ["kanji:23398"],
          mode: "quiz",
          title: "Test",
          size: 1,
          shuffle: false,
          repeatMistakes: false,
          prompt: "meaning",
          writingMode: "manual",
          guided: true,
          writingStrictness: "strict",
          writingHints: false,
          quizTimerSeconds: 30,
          hideAnswers: true,
          autoAdvance: true,
        },
        queue: ["kanji:23398"],
        index: 0,
        correct: 0,
        answers: 0,
        startedAt: 1,
      };
    });
    await updateProfile((draft) => {
      recordStudy(draft, {
        id: "session:0",
        key: "kanji:23398",
        mode: "quiz",
        at: 2,
        correct: true,
        durationMs: 600,
      });
      draft.savedSession!.index += 1;
      draft.savedSession!.answers += 1;
      draft.savedSession!.correct += 1;
    });
    const db = await openDB("kanji-study-web", 1);
    const stored = (await db.get("profile", "current")) as UserProfile;
    expect(stored.events).toHaveLength(1);
    expect(stored.savedSession).toMatchObject({
      index: 1,
      answers: 1,
      correct: 1,
    });
    expect(parseBackup(exportBackup()).savedSession).toEqual(
      stored.savedSession,
    );
    db.close();
  });
});

describe("backup validation and restore", () => {
  it("round trips Unicode, customizations, sets, settings, and progress", async () => {
    await updateProfile((draft) => {
      draft.notes["kanji:134047"] = "𠮟 — note";
      draft.favorites = ["kanji:134047", "word:1000000", "sentence:123"];
      draft.overrides["kanji:23398"] = {
        meaning: "My meaning",
        kunReading: "まな.ぶ",
      };
      draft.overrides["radical:20155"] = { reading: "にんべん" };
      draft.sets.push({
        id: "test",
        name: "我的集合",
        description: "",
        keys: ["kanji:134047", "radical:23398"],
        createdAt: 1,
        updatedAt: 1,
      });
      recordStudy(draft, {
        id: "test:0",
        at: 1,
        key: "kanji:134047",
        mode: "writing",
        correct: true,
        durationMs: 50,
        rating: 3,
      });
    });
    const expected = structuredClone(getProfile());
    const exported = exportBackup();
    await importBackup(backup());
    await importBackup(exported);
    expect(getProfile()).toEqual(expected);
  });

  it("rejects invalid imports without changing existing state", async () => {
    await updateProfile((draft) => {
      draft.notes["kanji:23398"] = "Keep me";
    });
    const original = structuredClone(getProfile());
    const malformed = createDefaultProfile();
    malformed.settings.dailyGoal = -1;
    await expect(importBackup(backup(malformed))).rejects.toThrow("dailyGoal");
    await expect(importBackup("{")).rejects.toThrow("not valid JSON");
    await expect(
      importBackup(
        JSON.stringify({
          app: "another-app",
          schemaVersion: 1,
          profile: original,
        }),
      ),
    ).rejects.toThrow("backup.app");
    expect(getProfile()).toEqual(original);
  });

  it("validates nested types, counters, identities, and uniqueness", () => {
    const malformed = createDefaultProfile();
    malformed.favorites = ["kanji:55296"]; // Surrogate code point is not a character.
    expect(() => validateProfile(malformed)).toThrow("Unicode scalar");
    malformed.favorites = ["kanji:23398", "kanji:23398"];
    expect(() => validateProfile(malformed)).toThrow("duplicate");
    malformed.favorites = [];
    recordStudy(malformed, {
      id: "1",
      key: "kanji:23398",
      at: 1,
      mode: "quiz",
      correct: true,
      durationMs: 0,
    });
    malformed.progress["kanji:23398"]!.correct = 2;
    expect(() => validateProfile(malformed)).toThrow("correct");
    expect(() =>
      parseBackup(
        JSON.stringify({
          app: "kanji-study-web",
          schemaVersion: 2,
          profile: createDefaultProfile(),
        }),
      ),
    ).toThrow("not supported");
  });

  it("keeps prototype-like note keys as ordinary data", () => {
    const raw = JSON.parse(backup()) as { profile: UserProfile };
    Object.defineProperty(raw.profile.notes, "__proto__", {
      value: "ordinary note",
      enumerable: true,
    });
    const parsed = parseBackup(JSON.stringify(raw));
    expect(
      Object.prototype.hasOwnProperty.call(parsed.notes, "__proto__"),
    ).toBe(true);
    expect(Object.getPrototypeOf(parsed.notes)).toBe(Object.prototype);
  });
});

describe("extension packs", () => {
  const extension: ExtensionPack = {
    schemaVersion: 1,
    id: "licensed-pack",
    name: "Personal extension",
    author: "Author",
    license: "User supplied",
    readings: [{ id: "r1", code: 23398, text: "学ぶ", translation: "Study" }],
    entries: [
      {
        code: 23398,
        explanation: "Example explanation",
        etymology: "Example source text",
      },
    ],
  };

  it("imports valid packs and replaces by stable pack ID", async () => {
    await importExtension(JSON.stringify(extension));
    await importExtension(
      JSON.stringify({ ...extension, name: "Updated title" }),
    );
    expect(getProfile().extensions).toHaveLength(1);
    expect(getProfile().extensions[0]?.name).toBe("Updated title");
    expect(parseBackup(exportBackup())).toEqual(getProfile());
  });

  it("rejects a malformed pack before writing anything", async () => {
    await expect(
      importExtension(
        JSON.stringify({
          ...extension,
          readings: [{ ...extension.readings[0], code: -1 }],
        }),
      ),
    ).rejects.toThrow("code");
    expect(getProfile().extensions).toEqual([]);
  });
});
