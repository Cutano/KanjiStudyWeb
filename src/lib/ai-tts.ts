import {
  cacheSpeech,
  getCachedSpeech,
  getTtsCacheGeneration,
  MAX_TTS_CACHE_BYTES,
  withTtsCacheLock,
} from "./tts-cache";
import {
  normalizeTtsSettings,
  type SpeechResponseFormat,
  type TtsSettings,
} from "./tts-settings";
import { pcmToWave, WAVE_HEADER_BYTES } from "./pcm-audio";

const pending = new Map<string, Promise<Blob>>();
const REQUEST_TIMEOUT_MS = 30_000;

async function readBody(
  response: Response,
  maxBytes: number,
  sizeError: string,
): Promise<Blob> {
  if (Number(response.headers.get("Content-Length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error(sizeError);
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
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error(sizeError);
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!bytes) throw new Error("The speech API returned empty audio.");
  return new Blob(chunks);
}

/** Show only a bounded JSON message, never headers, HTML, or an echoed API key. */
async function speechApiError(
  response: Response,
  apiKey: string,
): Promise<Error> {
  const fallback = `The speech API returned HTTP ${response.status}. Check its settings and try again.`;
  try {
    const type = response.headers
      .get("Content-Type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (type !== "application/json" && !type?.endsWith("+json")) {
      await response.body?.cancel();
      return new Error(fallback);
    }
    const body = await readBody(
      response,
      16_384,
      "Speech error response is too large.",
    );
    const payload: unknown = JSON.parse(await body.text());
    if (!payload || typeof payload !== "object") return new Error(fallback);
    const error = "error" in payload ? payload.error : payload;
    let detail =
      typeof error === "string"
        ? error
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "";
    for (const secret of [apiKey, encodeURIComponent(apiKey)]) {
      if (secret) detail = detail.split(secret).join("[REDACTED]");
    }
    detail = detail
      .replace(/Bearer\s+[^\s"<>]+/gi, "Bearer [REDACTED]")
      .replace(/sk-[a-zA-Z0-9_-]+/g, "[REDACTED]")
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 512);
    return new Error(
      detail
        ? `The speech API returned HTTP ${response.status}: ${detail}`
        : fallback,
    );
  } catch {
    return new Error(fallback);
  }
}

async function readAudio(
  response: Response,
  requested: SpeechResponseFormat,
): Promise<Blob> {
  const contentType = response.headers.get("Content-Type") ?? "";
  const type = contentType.split(";")[0].trim().toLowerCase();
  const unspecified = !type || type === "application/octet-stream";
  if (!unspecified && !type.startsWith("audio/")) {
    await response.body?.cancel();
    throw new Error("The speech API did not return audio.");
  }
  const pcm = type === "audio/pcm" || (unspecified && requested === "pcm");
  // The WAV header is also part of the persisted 50 MB cache budget.
  const body = await readBody(
    response,
    MAX_TTS_CACHE_BYTES - (pcm ? WAVE_HEADER_BYTES : 0),
    "The speech API returned more than 50 MB of audio.",
  );
  return pcm
    ? pcmToWave(body, contentType)
    : body.slice(0, body.size, unspecified ? "audio/mpeg" : type);
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
        response_format: settings.responseFormat,
      }),
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok) throw await speechApiError(response, settings.apiKey);
    const audio = await readAudio(response, settings.responseFormat);
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
  const identity = [
    normalized.endpoint,
    normalized.model,
    normalized.voice,
    input,
  ];
  // Keep pre-format MP3 identities so an upgrade does not regenerate paid clips.
  if (normalized.responseFormat !== "mp3")
    identity.push(normalized.responseFormat);
  const key = JSON.stringify(identity);
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
