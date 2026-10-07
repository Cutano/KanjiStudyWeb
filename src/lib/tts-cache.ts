import { openTtsDatabase } from "./tts-settings";

export const MAX_TTS_CACHE_BYTES = 50_000_000;
export const MAX_TTS_CACHE_ENTRIES = 10;

const CACHE_LOCK = "kanji-study-web-tts-cache";

/** Shared request locks let a clear wait for current requests before deleting. */
export function withTtsCacheLock<T>(
  mode: LockMode,
  action: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(CACHE_LOCK, { mode }, action);
  }
  return action();
}

export async function getCachedSpeech(key: string): Promise<Blob | undefined> {
  const db = await openTtsDatabase();
  const transaction = db.transaction(["audio", "metadata"], "readwrite");
  const audio = transaction.objectStore("audio");
  const metadata = transaction.objectStore("metadata");
  const cached = await audio.get(key);
  if (cached) {
    const lastUsed = ((await metadata.get("accessCounter")) ?? 0) + 1;
    await metadata.put(lastUsed, "accessCounter");
    await audio.put({ ...cached, lastUsed });
  }
  await transaction.done;
  return cached
    ? new Blob([cached.data], { type: cached.mimeType })
    : undefined;
}

export async function getTtsCacheGeneration(): Promise<number> {
  const db = await openTtsDatabase();
  return (await db.get("metadata", "generation")) ?? 0;
}

/** Insert and LRU eviction commit together, so neither bound is ever exceeded. */
export async function cacheSpeech(
  key: string,
  audio: Blob,
  generation: number,
): Promise<void> {
  if (!audio.size || audio.size > MAX_TTS_CACHE_BYTES) {
    throw new Error("Speech audio must be nonempty and no larger than 50 MB.");
  }
  // ArrayBuffer storage avoids WebKit's Blob/File persistence failure.
  // Read it before the transaction starts so asynchronous conversion cannot
  // leave an IndexedDB transaction inactive.
  const data = await audio.arrayBuffer();
  const mimeType = audio.type;
  const db = await openTtsDatabase();
  const transaction = db.transaction(["audio", "metadata"], "readwrite");
  const store = transaction.objectStore("audio");
  const metadata = transaction.objectStore("metadata");
  // Also protects against in-flight writes on browsers without Web Locks.
  if (((await metadata.get("generation")) ?? 0) !== generation) {
    await transaction.done;
    return;
  }
  const lastUsed = ((await metadata.get("accessCounter")) ?? 0) + 1;
  const entries = (await store.getAll()).filter((entry) => entry.key !== key);
  entries.push({ key, data, mimeType, lastUsed });
  entries.sort((left, right) => left.lastUsed - right.lastUsed);
  let bytes = entries.reduce((sum, entry) => sum + entry.data.byteLength, 0);
  while (
    entries.length > MAX_TTS_CACHE_ENTRIES ||
    bytes > MAX_TTS_CACHE_BYTES
  ) {
    const oldest = entries.shift()!;
    bytes -= oldest.data.byteLength;
    await store.delete(oldest.key);
  }
  await metadata.put(lastUsed, "accessCounter");
  await store.put({ key, data, mimeType, lastUsed });
  await transaction.done;
}

export async function getTtsCacheStats(): Promise<{
  count: number;
  bytes: number;
}> {
  const db = await openTtsDatabase();
  const entries = await db.getAll("audio");
  return {
    count: entries.length,
    bytes: entries.reduce((sum, entry) => sum + entry.data.byteLength, 0),
  };
}

export function clearTtsCache(): Promise<void> {
  return withTtsCacheLock("exclusive", async () => {
    const db = await openTtsDatabase();
    const transaction = db.transaction(["audio", "metadata"], "readwrite");
    const metadata = transaction.objectStore("metadata");
    await transaction.objectStore("audio").clear();
    await metadata.put(
      ((await metadata.get("generation")) ?? 0) + 1,
      "generation",
    );
    await transaction.done;
  });
}
