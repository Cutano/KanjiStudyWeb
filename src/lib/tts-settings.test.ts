import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { exportBackup } from "../state/profile";
import {
  DEFAULT_TTS_SETTINGS,
  getTtsSettings,
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
      endpoint: "https://speech.example/v1/audio/speech",
      apiKey: "private-test-key",
      model: "custom-model",
      voice: "custom-voice",
    });
    expect(exportBackup()).not.toContain("private-test-key");
    expect(exportBackup()).not.toContain("speech.example");
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
