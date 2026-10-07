import "fake-indexeddb/auto";
import { openDB } from "idb";
import { expect, it } from "vitest";
import { getTtsCacheStats } from "./tts-cache";
import {
  DEFAULT_TTS_SETTINGS,
  getTtsSettings,
  openTtsDatabase,
} from "./tts-settings";

it("replaces candidate Blob audio without removing saved API settings or metadata", async () => {
  const previous = await openDB("kanji-study-web-tts", 1, {
    upgrade(db) {
      db.createObjectStore("settings");
      db.createObjectStore("audio", { keyPath: "key" });
      db.createObjectStore("metadata");
    },
  });
  const settings = {
    ...DEFAULT_TTS_SETTINGS,
    apiKey: "migration-test-key",
    voice: "alloy",
  };
  await previous.put("settings", settings, "current");
  await previous.put("audio", {
    key: "candidate",
    audio: new Blob(["old audio"]),
    lastUsed: 8,
  });
  await previous.put("metadata", 8, "accessCounter");
  await previous.put("metadata", 3, "generation");
  previous.close();

  expect(await getTtsSettings()).toEqual(settings);
  expect(await getTtsCacheStats()).toEqual({ count: 0, bytes: 0 });
  const upgraded = await openTtsDatabase();
  expect(upgraded.version).toBe(2);
  expect(await upgraded.get("metadata", "accessCounter")).toBe(8);
  expect(await upgraded.get("metadata", "generation")).toBe(3);
});
