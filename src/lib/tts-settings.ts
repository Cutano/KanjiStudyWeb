import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type SpeechResponseFormat = "mp3" | "pcm";

export interface TtsSettings {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  voice: string;
  responseFormat: SpeechResponseFormat;
}

export const DEFAULT_TTS_SETTINGS: Readonly<TtsSettings> = Object.freeze({
  enabled: true,
  endpoint: "https://api.openai.com/v1/audio/speech",
  apiKey: "",
  model: "gpt-4o-mini-tts",
  voice: "coral",
  responseFormat: "mp3",
});

export interface CachedSpeech {
  key: string;
  data: ArrayBuffer;
  mimeType: string;
  lastUsed: number;
}

interface TtsDatabase extends DBSchema {
  settings: {
    key: string;
    value: Omit<TtsSettings, "enabled" | "responseFormat"> &
      Partial<Pick<TtsSettings, "enabled" | "responseFormat">>;
  };
  audio: { key: string; value: CachedSpeech };
  metadata: { key: string; value: number };
}

let database: Promise<IDBPDatabase<TtsDatabase>> | undefined;

/** Device-only credentials and disposable audio never enter profile backups. */
export function openTtsDatabase(): Promise<IDBPDatabase<TtsDatabase>> {
  database ??= openDB<TtsDatabase>("kanji-study-web-tts", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion === 0) {
        db.createObjectStore("settings");
        db.createObjectStore("metadata");
      } else {
        // Audio is disposable; preserve device settings while replacing the
        // first candidate's Blob records with portable ArrayBuffer records.
        db.deleteObjectStore("audio");
      }
      db.createObjectStore("audio", { keyPath: "key" });
    },
    blocking() {
      void database?.then((db) => db.close());
      database = undefined;
    },
  }).catch((error: unknown) => {
    database = undefined;
    throw error;
  });
  return database;
}

export function normalizeTtsSettings(settings: TtsSettings): TtsSettings {
  const normalized = {
    enabled: settings.enabled,
    endpoint: settings.endpoint.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    voice: settings.voice.trim(),
    responseFormat: settings.responseFormat,
  };
  let endpoint: URL;
  try {
    endpoint = new URL(normalized.endpoint);
  } catch {
    throw new Error("Enter a valid speech API URL.");
  }
  const localHttp =
    endpoint.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !localHttp) {
    throw new Error("The speech API must use HTTPS (or HTTP on localhost).");
  }
  if (
    endpoint.username ||
    endpoint.password ||
    normalized.endpoint.includes("?") ||
    normalized.endpoint.includes("#")
  ) {
    throw new Error(
      "The speech API URL cannot contain credentials, a query, or a fragment.",
    );
  }
  if (!normalized.model || !normalized.voice) {
    throw new Error("Enter both a speech model and a voice.");
  }
  if (!["mp3", "pcm"].includes(normalized.responseFormat)) {
    throw new Error("Choose MP3 or PCM as the speech output format.");
  }
  if (/[\r\n]/.test(normalized.apiKey)) {
    throw new Error("The API key cannot contain line breaks.");
  }
  normalized.endpoint = endpoint.href;
  return normalized;
}

export async function getTtsSettings(): Promise<TtsSettings> {
  const db = await openTtsDatabase();
  const stored = await db.get("settings", "current");
  return stored
    ? {
        ...stored,
        enabled: stored.enabled ?? true,
        responseFormat: stored.responseFormat ?? "mp3",
      }
    : { ...DEFAULT_TTS_SETTINGS };
}

export async function saveTtsSettings(settings: TtsSettings): Promise<void> {
  const normalized = normalizeTtsSettings(settings);
  const db = await openTtsDatabase();
  await db.put("settings", normalized, "current");
}
