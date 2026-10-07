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

  it("requests PCM once, caches playable WAV separately, and preserves old MP3 cache identities", async () => {
    const db = await openTtsDatabase();
    await db.put("audio", {
      key: JSON.stringify([
        settings.endpoint,
        settings.model,
        settings.voice,
        "漢字",
      ]),
      data: new Uint8Array([73, 68, 51]).buffer,
      mimeType: "audio/mpeg",
      lastUsed: 1,
    });
    const fetch = vi.fn(
      async () =>
        new Response(new Uint8Array([0, 128, 255, 127]), {
          headers: { "Content-Type": "audio/pcm;rate=24000;channels=1" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    expect((await getAiSpeech("漢字", settings)).type).toBe("audio/mpeg");
    expect(fetch).not.toHaveBeenCalled();
    const pcmSettings = { ...settings, responseFormat: "pcm" as const };
    const wave = await getAiSpeech("漢字", pcmSettings);
    expect(fetch).toHaveBeenCalledWith(
      settings.endpoint,
      expect.objectContaining({
        body: expect.stringContaining('"response_format":"pcm"'),
      }),
    );
    expect(wave.type).toBe("audio/wav");
    expect(wave.size).toBe(48);
    fetch.mockRejectedValue(new Error("Offline"));
    const cached = await getAiSpeech("漢字", pcmSettings);
    expect(await cached.arrayBuffer()).toEqual(await wave.arrayBuffer());
    expect(cached.type).toBe("audio/wav");
    expect(fetch).toHaveBeenCalledOnce();
    expect(await getTtsCacheStats()).toEqual({ count: 2, bytes: 51 });
  });

  it("uses the selected PCM format for a binary response without MIME metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 0]))),
    );
    expect(
      (await getAiSpeech("漢字", { ...settings, responseFormat: "pcm" })).type,
    ).toBe("audio/wav");
  });

  it("does not wrap audio that already has a playable container", async () => {
    const bytes = new Uint8Array([82, 73, 70, 70]);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(bytes, { headers: { "Content-Type": "audio/wav" } }),
      ),
    );
    const audio = await getAiSpeech("漢字", {
      ...settings,
      responseFormat: "pcm",
    });
    expect(await audio.arrayBuffer()).toEqual(bytes.buffer);
    expect(audio.type).toBe("audio/wav");
  });

  it("includes the WAV header in the 50 MB bound", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([0, 0]), {
            headers: {
              "Content-Type": "audio/pcm",
              "Content-Length": String(MAX_TTS_CACHE_BYTES - 42),
            },
          }),
      ),
    );
    await expect(
      getAiSpeech("漢字", { ...settings, responseFormat: "pcm" }),
    ).rejects.toThrow("50 MB");
    expect((await getTtsCacheStats()).count).toBe(0);
  });

  it("surfaces the provider's format error without retrying or caching it", async () => {
    const detail = 'Gemini TTS only supports response_format="pcm". Got "mp3".';
    const fetch = vi.fn(async () =>
      Response.json({ error: { message: detail } }, { status: 400 }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(getAiSpeech("漢字", settings)).rejects.toThrow(
      `HTTP 400: ${detail}`,
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect((await getTtsCacheStats()).count).toBe(0);
  });

  it("redacts echoed credentials before displaying a bounded provider message", async () => {
    const apiKey = "test+/=token";
    const detail = `Bad key ${apiKey} ${encodeURIComponent(apiKey)} Bearer other-token sk-or-test-token ${"x".repeat(700)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: { message: detail } }, { status: 401 }),
      ),
    );
    const error = await getAiSpeech("漢字", { ...settings, apiKey }).catch(
      (reason: Error) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("[REDACTED]");
    for (const secret of [
      apiKey,
      encodeURIComponent(apiKey),
      "other-token",
      "sk-or-test-token",
    ]) {
      expect(message).not.toContain(secret);
    }
    expect(message.length).toBeLessThan(560);
  });

  it.each([
    "<html>gateway error</html>",
    "{broken json",
    JSON.stringify({ other: "private detail" }),
  ])(
    "keeps generic HTTP context when a JSON error message is unavailable",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(body, {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }),
        ),
      );
      await expect(getAiSpeech("漢字", settings)).rejects.toThrow(
        "HTTP 502. Check its settings",
      );
    },
  );

  it("bounds streamed error bodies and cancels oversized diagnostics", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16_385));
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(body, {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(getAiSpeech("漢字", settings)).rejects.toThrow(
      "HTTP 400. Check its settings",
    );
    expect(cancel).toHaveBeenCalledOnce();
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
