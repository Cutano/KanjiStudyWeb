import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalog } from "../data/catalog";
import { getAiSpeech } from "./ai-tts";
import { getTtsSettings, DEFAULT_TTS_SETTINGS } from "./tts-settings";
import { loadPronunciation, playPronunciation } from "./pronunciation";
import { speakJapanese } from "./speech";

vi.mock("../data/catalog", () => ({ catalog: { getAudioBlob: vi.fn() } }));
vi.mock("./ai-tts", () => ({ getAiSpeech: vi.fn() }));
vi.mock("./tts-settings", async (original) => ({
  ...(await original<typeof import("./tts-settings")>()),
  getTtsSettings: vi.fn(),
}));
vi.mock("./speech", () => ({ speakJapanese: vi.fn() }));

const recording = new Blob(["recording"], { type: "audio/mpeg" });
const generated = new Blob(["generated"], { type: "audio/mpeg" });
const controllers: AbortController[] = [];
const play = vi.fn();
function controller() {
  const value = new AbortController();
  controllers.push(value);
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTtsSettings).mockResolvedValue({
    ...DEFAULT_TTS_SETTINGS,
    apiKey: "test-only",
  });
  vi.mocked(catalog.getAudioBlob).mockResolvedValue(recording);
  vi.mocked(getAiSpeech).mockResolvedValue(generated);
  play.mockResolvedValue(undefined);
  vi.stubGlobal("window", { speechSynthesis: { cancel: vi.fn() } });
  vi.stubGlobal(
    "Audio",
    class extends EventTarget {
      src = "";
      pause() {}
      removeAttribute() {}
      play = play;
    },
  );
});
afterEach(() => {
  for (const item of controllers.splice(0)) item.abort();
  vi.unstubAllGlobals();
});

describe("pronunciation source selection", () => {
  it("uses a bundled recording without reading API credentials or generating audio", async () => {
    vi.mocked(getTtsSettings).mockResolvedValue({
      ...DEFAULT_TTS_SETTINGS,
      enabled: false,
      apiKey: "test-only",
    });
    expect(await loadPronunciation("がっこう", "school|other")).toEqual({
      source: "recording",
      blob: recording,
    });
    expect(catalog.getAudioBlob).toHaveBeenCalledWith("school");
    expect(getTtsSettings).not.toHaveBeenCalled();
    expect(getAiSpeech).not.toHaveBeenCalled();
  });
  it("uses AI speech when a catalog clip is missing", async () => {
    vi.mocked(catalog.getAudioBlob).mockRejectedValueOnce(new Error("Missing"));
    expect(await loadPronunciation("かんじ", "missing")).toEqual({
      source: "ai",
      blob: generated,
    });
    expect(getAiSpeech).toHaveBeenCalledWith(
      "かんじ",
      expect.objectContaining({ apiKey: "test-only" }),
    );
  });
  it("chooses browser speech when no API key is configured", async () => {
    vi.mocked(getTtsSettings).mockResolvedValueOnce({
      ...DEFAULT_TTS_SETTINGS,
    });
    expect(await loadPronunciation("日本語")).toEqual({ source: "browser" });
    expect(getAiSpeech).not.toHaveBeenCalled();
  });
  it("bypasses AI speech and its cache when disabled, while preserving the configured key", async () => {
    vi.mocked(getTtsSettings).mockResolvedValue({
      ...DEFAULT_TTS_SETTINGS,
      enabled: false,
      apiKey: "configured-test-key",
    });
    vi.mocked(catalog.getAudioBlob).mockRejectedValueOnce(new Error("Missing"));
    expect(await loadPronunciation("日本語", "missing")).toEqual({
      source: "browser",
    });
    expect(await loadPronunciation("日本語")).toEqual({ source: "browser" });
    expect(getAiSpeech).not.toHaveBeenCalled();
  });
  it("surfaces API errors rather than silently switching voices or retrying", async () => {
    vi.mocked(getAiSpeech).mockRejectedValueOnce(new Error("HTTP 401"));
    await expect(loadPronunciation("日本語")).rejects.toThrow("HTTP 401");
    expect(getAiSpeech).toHaveBeenCalledTimes(1);
    expect(speakJapanese).not.toHaveBeenCalled();
  });
});

describe("playback ownership", () => {
  it("ignores an already canceled request before accessing audio or credentials", async () => {
    const abort = controller();
    abort.abort();
    await playPronunciation({
      text: "日本語",
      signal: abort.signal,
      onSource: vi.fn(),
    });
    expect(getTtsSettings).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });
  it("does not play a generated clip after its view has been closed", async () => {
    let finish!: (blob: Blob) => void;
    vi.mocked(getAiSpeech).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const abort = controller();
    const onSource = vi.fn();
    const operation = playPronunciation({
      text: "日本語",
      signal: abort.signal,
      onSource,
    });
    await vi.waitFor(() => expect(getAiSpeech).toHaveBeenCalled());
    abort.abort();
    finish(generated);
    await operation;
    expect(play).not.toHaveBeenCalled();
    expect(onSource).not.toHaveBeenCalled();
  });
  it("plays the latest requested clip even when an earlier generation finishes later", async () => {
    let finish!: (blob: Blob) => void;
    vi.mocked(getAiSpeech).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const earlier = vi.fn(),
      latest = vi.fn();
    const first = playPronunciation({
      text: "前",
      signal: controller().signal,
      onSource: earlier,
    });
    await vi.waitFor(() => expect(getAiSpeech).toHaveBeenCalled());
    await playPronunciation({
      text: "後",
      resource: "recorded",
      signal: controller().signal,
      onSource: latest,
    });
    finish(generated);
    await first;
    expect(play).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledWith("recording");
    expect(earlier).not.toHaveBeenCalled();
  });
  it("does not trigger AI billing when native media playback is blocked", async () => {
    play.mockRejectedValueOnce(
      new DOMException("Tap to play", "NotAllowedError"),
    );
    await expect(
      playPronunciation({
        text: "日本語",
        resource: "recorded",
        signal: controller().signal,
        onSource: vi.fn(),
      }),
    ).rejects.toThrow("Tap to play");
    expect(getAiSpeech).not.toHaveBeenCalled();
  });
});
