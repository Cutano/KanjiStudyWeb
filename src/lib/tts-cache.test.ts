import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  cacheSpeech,
  clearTtsCache,
  getCachedSpeech,
  getTtsCacheGeneration,
  getTtsCacheStats,
  MAX_TTS_CACHE_BYTES,
} from "./tts-cache";
import { openTtsDatabase } from "./tts-settings";

beforeEach(clearTtsCache);

async function put(key: string, bytes = 10): Promise<void> {
  await cacheSpeech(
    key,
    new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }),
    await getTtsCacheGeneration(),
  );
}

describe("bounded persistent speech cache", () => {
  it("stores portable bytes and reconstructs the original audio and MIME type", async () => {
    const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
    const generation = await getTtsCacheGeneration();
    await cacheSpeech(
      "portable",
      new Blob([bytes], { type: "audio/wav" }),
      generation,
    );
    const db = await openTtsDatabase();
    const stored = await db.get("audio", "portable");
    expect(stored?.data).toBeInstanceOf(ArrayBuffer);
    expect(stored).not.toHaveProperty("audio");
    const clip = await getCachedSpeech("portable");
    expect(clip?.type).toBe("audio/wav");
    expect(new Uint8Array(await clip!.arrayBuffer())).toEqual(bytes);
    expect(await getTtsCacheStats()).toEqual({ count: 1, bytes: bytes.length });
  });

  it("retains at most ten clips and updates LRU order when a clip is replayed", async () => {
    for (let index = 0; index < 10; index += 1) await put(String(index));
    expect(await getCachedSpeech("0")).toBeDefined();
    await put("10");
    expect(await getCachedSpeech("1")).toBeUndefined();
    expect(await getCachedSpeech("0")).toBeDefined();
    expect(await getTtsCacheStats()).toEqual({ count: 10, bytes: 100 });
  });

  it("evicts by aggregate byte size even when fewer than ten clips are stored", async () => {
    await put("old", 25_000_000);
    await put("recent", 20_000_000);
    await put("new", 10_000_000);
    expect(await getCachedSpeech("old")).toBeUndefined();
    expect(await getTtsCacheStats()).toEqual({ count: 2, bytes: 30_000_000 });
  });

  it("replaces an identity without double-counting and permits exactly the byte limit", async () => {
    await put("replace", 100);
    await put("replace", 50);
    expect(await getTtsCacheStats()).toEqual({ count: 1, bytes: 50 });
    await put("full", MAX_TTS_CACHE_BYTES);
    expect(await getTtsCacheStats()).toEqual({
      count: 1,
      bytes: MAX_TTS_CACHE_BYTES,
    });
    expect(await getCachedSpeech("replace")).toBeUndefined();
  });

  it("atomically trims competing writers and rejects empty or oversized clips", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) => put(String(index))),
    );
    expect(await getTtsCacheStats()).toEqual({ count: 10, bytes: 100 });
    await expect(put("empty", 0)).rejects.toThrow("nonempty");
    await expect(put("too big", MAX_TTS_CACHE_BYTES + 1)).rejects.toThrow(
      "50 MB",
    );
    expect(await getTtsCacheStats()).toEqual({ count: 10, bytes: 100 });
  });

  it("does not let a request from before Clear repopulate the cache", async () => {
    const generation = await getTtsCacheGeneration();
    await put("old");
    await clearTtsCache();
    await cacheSpeech("in-flight", new Blob(["audio"]), generation);
    expect(await getTtsCacheStats()).toEqual({ count: 0, bytes: 0 });
    await put("after-clear");
    expect(await getTtsCacheStats()).toEqual({ count: 1, bytes: 10 });
  });
});
