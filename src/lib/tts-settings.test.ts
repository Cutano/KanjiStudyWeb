import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { exportBackup } from "../state/profile";
import {
  DEFAULT_TTS_SETTINGS,
  getTtsSettings,
  openTtsDatabase,
  saveTtsSettings,
} from "./tts-settings";

beforeEach(async () => {
  await saveTtsSettings({ ...DEFAULT_TTS_SETTINGS });
});

describe("device-only AI speech settings", () => {
  it("stores normalized settings outside the study profile and its backup", async () => {
    await saveTtsSettings({
      ...DEFAULT_TTS_SETTINGS,
      endpoint: " https://speech.example/v1/audio/speech ",
      apiKey: " private-test-key ",
      model: " custom-model ",
      voice: " custom-voice ",
    });
    expect(await getTtsSettings()).toEqual({
      enabled: true,
      endpoint: "https://speech.example/v1/audio/speech",
      apiKey: "private-test-key",
      model: "custom-model",
      voice: "custom-voice",
    });
    expect(exportBackup()).not.toContain("private-test-key");
    expect(exportBackup()).not.toContain("speech.example");
  });

  it("persists an independent disabled state without removing the API configuration", async () => {
    const disabled = {
      ...DEFAULT_TTS_SETTINGS,
      enabled: false,
      apiKey: "retained-test-key",
      voice: "alloy",
    };
    await saveTtsSettings(disabled);
    expect(await getTtsSettings()).toEqual(disabled);
    const db = await openTtsDatabase();
    expect((await db.get("settings", "current"))?.enabled).toBe(false);
    await saveTtsSettings({ ...(await getTtsSettings()), enabled: true });
    expect(await getTtsSettings()).toEqual({ ...disabled, enabled: true });
  });

  it("keeps existing API configuration enabled when its stored record predates the switch", async () => {
    const db = await openTtsDatabase();
    const legacy = {
      endpoint: DEFAULT_TTS_SETTINGS.endpoint,
      model: DEFAULT_TTS_SETTINGS.model,
      voice: "alloy",
      apiKey: "legacy-test-key",
    };
    await db.put("settings", legacy, "current");
    await db.put("audio", {
      key: "existing-clip",
      data: new Uint8Array([1, 2, 3]).buffer,
      mimeType: "audio/mpeg",
      lastUsed: 1,
    });
    expect(await getTtsSettings()).toEqual({ ...legacy, enabled: true });
    expect(db.version).toBe(2);
    expect(await db.get("audio", "existing-clip")).toBeDefined();
  });

  it.each([
    "not a URL",
    "http://speech.example/audio/speech",
    "http://[::1]:1234/speech",
    "https://key@speech.example/audio/speech",
    "https://speech.example/audio/speech?key=secret",
    "https://speech.example/audio/speech#secret",
    "https://speech.example/audio/speech?",
    "https://speech.example/audio/speech#",
    "javascript:alert(1)",
  ])("rejects an unsafe API endpoint: %s", async (endpoint) => {
    await expect(
      saveTtsSettings({ ...DEFAULT_TTS_SETTINGS, endpoint }),
    ).rejects.toThrow();
    expect(await getTtsSettings()).toEqual(DEFAULT_TTS_SETTINGS);
  });

  it.each([
    "http://localhost:1234/v1/audio/speech",
    "http://127.0.0.1:1234/speech",
  ])("allows local development endpoints: %s", async (endpoint) => {
    await saveTtsSettings({ ...DEFAULT_TTS_SETTINGS, endpoint });
    expect((await getTtsSettings()).endpoint).toBe(endpoint);
  });

  it("requires a model and voice while allowing the user to remove the key", async () => {
    await expect(
      saveTtsSettings({ ...DEFAULT_TTS_SETTINGS, model: " " }),
    ).rejects.toThrow("model");
    await expect(
      saveTtsSettings({ ...DEFAULT_TTS_SETTINGS, voice: " " }),
    ).rejects.toThrow("voice");
    await expect(
      saveTtsSettings({ ...DEFAULT_TTS_SETTINGS, apiKey: "key\nline" }),
    ).rejects.toThrow("line breaks");
    await saveTtsSettings({ ...DEFAULT_TTS_SETTINGS, apiKey: " " });
    expect((await getTtsSettings()).apiKey).toBe("");
  });
});
