import {
  cacheSpeech,
  getCachedSpeech,
  getTtsCacheGeneration,
  MAX_TTS_CACHE_BYTES,
  withTtsCacheLock,
} from "./tts-cache";
import { normalizeTtsSettings, type TtsSettings } from "./tts-settings";

const pending = new Map<string, Promise<Blob>>();
const REQUEST_TIMEOUT_MS = 30_000;

async function readAudio(response: Response): Promise<Blob> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `The speech API returned HTTP ${response.status}. Check its settings and try again.`,
    );
  }
  const contentType =
    response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() ??
    "";
  if (
    contentType &&
    !contentType.startsWith("audio/") &&
    contentType !== "application/octet-stream"
  ) {
    await response.body?.cancel();
    throw new Error("The speech API did not return audio.");
  }
  if (Number(response.headers.get("Content-Length")) > MAX_TTS_CACHE_BYTES) {
    await response.body?.cancel();
    throw new Error("The speech API returned more than 50 MB of audio.");
  }
  if (!response.body) throw new Error("The speech API returned empty audio.");
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_TTS_CACHE_BYTES) {
        await reader.cancel();
        throw new Error("The speech API returned more than 50 MB of audio.");
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!bytes) throw new Error("The speech API returned empty audio.");
  return new Blob(chunks, {
    type: contentType.startsWith("audio/") ? contentType : "audio/mpeg",
  });
}

async function requestSpeech(
  key: string,
  text: string,
  settings: TtsSettings,
): Promise<Blob> {
  const cached = await getCachedSpeech(key);
  if (cached) return cached;
  if (!settings.apiKey)
    throw new Error("Configure an AI speech API key in Settings first.");
  const generation = await getTtsCacheGeneration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(settings.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        voice: settings.voice,
        input: text,
        response_format: "mp3",
      }),
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
    });
    const audio = await readAudio(response);
    await cacheSpeech(key, audio, generation);
    return audio;
  } finally {
    clearTimeout(timeout);
  }
}

/** Identity describes the generated voice, never the secret used to request it. */
export function getAiSpeech(
  text: string,
  settings: TtsSettings,
): Promise<Blob> {
  const input = text.trim();
  if (!input || Array.from(input).length > 4096) {
    return Promise.reject(
      new Error("AI speech needs between 1 and 4,096 characters."),
    );
  }
  let normalized: TtsSettings;
  try {
    normalized = normalizeTtsSettings(settings);
  } catch (error) {
    return Promise.reject(error);
  }
  const key = JSON.stringify([
    normalized.endpoint,
    normalized.model,
    normalized.voice,
    input,
  ]);
  const previous = pending.get(key);
  if (previous) return previous;
  const operation = withTtsCacheLock("shared", async () => {
    const request = () => requestSpeech(key, input, normalized);
    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks.request(
        `kanji-study-web-tts-request:${key}`,
        request,
      );
    }
    return request();
  });
  pending.set(key, operation);
  void operation.finally(() => pending.delete(key)).catch(() => undefined);
  return operation;
}
