import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAiSpeech } from "./ai-tts";
import {
  clearTtsCache,
  getTtsCacheStats,
  MAX_TTS_CACHE_BYTES,
} from "./tts-cache";
import { DEFAULT_TTS_SETTINGS, openTtsDatabase } from "./tts-settings";

const settings = { ...DEFAULT_TTS_SETTINGS, apiKey: "unit-test-key" };
const audioResponse = () =>
  new Response(new Uint8Array([73, 68, 51, 1, 2]), {
    headers: { "Content-Type": "audio/mpeg" },
  });

beforeEach(clearTtsCache);
afterEach(() => vi.unstubAllGlobals());

describe("AI speech requests", () => {
  it("coalesces repeated requests, uses the speech contract, and reuses persistent audio offline after a key change", async () => {
    const fetch = vi.fn(async () => audioResponse());
    vi.stubGlobal("fetch", fetch);
    const [first, duplicate] = await Promise.all([
      getAiSpeech(" 漢字 ", settings),
      getAiSpeech("漢字", settings),
    ]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(duplicate).toBe(first);
    expect(fetch).toHaveBeenCalledWith(
      settings.endpoint,
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer unit-test-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.model,
          voice: settings.voice,
          input: "漢字",
          response_format: "mp3",
        }),
        credentials: "omit",
        redirect: "error",
      }),
    );
    fetch.mockRejectedValue(new Error("Offline"));
    expect(
      (await getAiSpeech("漢字", { ...settings, apiKey: "changed-key" })).size,
    ).toBe(5);
    expect((await getAiSpeech("漢字", { ...settings, apiKey: "" })).size).toBe(
      5,
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(await getTtsCacheStats()).toEqual({ count: 1, bytes: 5 });
    const db = await openTtsDatabase();
    expect(JSON.stringify(await db.getAllKeys("audio"))).not.toContain(
      settings.apiKey,
    );
  });

  it("coalesces independent callers through Web Locks, like separate browser tabs", async () => {
    const fetch = vi.fn(async () => audioResponse());
    vi.stubGlobal("fetch", fetch);
    vi.resetModules();
    const otherTab = await import("./ai-tts");
    await Promise.all([
      getAiSpeech("漢字", settings),
      otherTab.getAiSpeech("漢字", settings),
    ]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("uses endpoint, model, voice, and text as distinct cache identities", async () => {
    const fetch = vi.fn(async () => audioResponse());
    vi.stubGlobal("fetch", fetch);
    await getAiSpeech("漢字", settings);
    await getAiSpeech("漢字", { ...settings, model: "tts-1" });
    await getAiSpeech("漢字", { ...settings, voice: "alloy" });
    await getAiSpeech("漢字", {
      ...settings,
      endpoint: "https://speech.example/audio/speech",
    });
    await getAiSpeech("今日", settings);
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("does not cache API errors and allows a later retry", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Do not echo API errors or keys", { status: 401 }),
      )
      .mockResolvedValueOnce(audioResponse());
    vi.stubGlobal("fetch", fetch);
    await expect(getAiSpeech("漢字", settings)).rejects.toThrow("HTTP 401");
    expect(await getTtsCacheStats()).toEqual({ count: 0, bytes: 0 });
    expect((await getAiSpeech("漢字", settings)).size).toBe(5);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    () =>
      new Response("{}", { headers: { "Content-Type": "application/json" } }),
    () =>
      new Response(new Uint8Array(0), {
        headers: { "Content-Type": "audio/mpeg" },
      }),
    () =>
      new Response("large", {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(MAX_TTS_CACHE_BYTES + 1),
        },
      }),
  ])(
    "rejects invalid audio responses without caching them",
    async (response) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response()),
      );
      await expect(getAiSpeech("漢字", settings)).rejects.toThrow();
      expect(await getTtsCacheStats()).toEqual({ count: 0, bytes: 0 });
    },
  );

  it("bounds chunked audio while reading and cancels an oversized response", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(25_000_001));
        controller.enqueue(new Uint8Array(25_000_000));
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(stream, { headers: { "Content-Type": "audio/mpeg" } }),
      ),
    );
    await expect(getAiSpeech("漢字", settings)).rejects.toThrow("50 MB");
    expect(cancel).toHaveBeenCalledOnce();
    expect(await getTtsCacheStats()).toEqual({ count: 0, bytes: 0 });
  });

  it("rejects missing credentials and invalid input before making a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      getAiSpeech("漢字", { ...settings, apiKey: "" }),
    ).rejects.toThrow("API key");
    await expect(getAiSpeech(" ", settings)).rejects.toThrow("characters");
    await expect(getAiSpeech("字".repeat(4097), settings)).rejects.toThrow(
      "characters",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps Clear effective when a pending request finishes without Web Locks", async () => {
    vi.stubGlobal("navigator", { locks: undefined });
    let finish!: (response: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const request = getAiSpeech("漢字", settings);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await clearTtsCache();
    finish(audioResponse());
    expect((await request).size).toBe(5);
    expect(await getTtsCacheStats()).toEqual({ count: 0, bytes: 0 });
  });

  it("finishes Clear after locked requests without leaving audio behind", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const request = getAiSpeech("漢字", settings);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const cleared = clearTtsCache();
    finish(audioResponse());
    await Promise.all([request, cleared]);
    expect(await getTtsCacheStats()).toEqual({ count: 0, bytes: 0 });
  });
});
