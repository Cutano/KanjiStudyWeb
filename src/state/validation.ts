import type {
  CharacterKey,
  CharacterProgress,
  CustomSet,
  ExtensionPack,
  Rating,
  ReviewCard,
  SavedSession,
  Settings,
  StudyConfig,
  StudyEvent,
  UserProfile,
} from "../domain/types";

const MAX_JSON_LENGTH = 20 * 1_024 * 1_024;
const systems = [
  "jouyou",
  "jouyou_revised",
  "jlpt",
  "jlpt_revised",
  "heisig",
  "heisig_revised",
  "kanken",
  "kanken_revised",
  "kklc",
  "freq",
  "hadamitzky",
  "kic",
] as const;
const modes = ["flashcards", "quiz", "writing", "reading"] as const;

function invalid(path: string, expectation: string): never {
  throw new Error(`Invalid import: ${path} ${expectation}.`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid(path, "must be an object");
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, maximum = 100_000): string {
  if (typeof value !== "string" || value.length > maximum)
    invalid(path, `must be text no longer than ${maximum} characters`);
  return value;
}

function identifier(value: unknown, path: string): string {
  const result = text(value, path, 200);
  if (!result.trim()) invalid(path, "must not be empty");
  return result;
}

function number(
  value: unknown,
  path: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    invalid(
      path,
      `must be ${integer ? "an integer" : "a number"} between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") invalid(path, "must be true or false");
  return value;
}

function choice<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T))
    invalid(path, "has an unsupported value");
  return value as T;
}

function array<T>(
  value: unknown,
  parse: (item: unknown, path: string) => T,
  path: string,
  maximum = 100_000,
): T[] {
  if (!Array.isArray(value) || value.length > maximum)
    invalid(path, `must be an array with at most ${maximum} items`);
  return value.map((item, index) => parse(item, `${path}[${index}]`));
}

function unique<T>(items: T[], key: (item: T) => string, path: string): T[] {
  if (new Set(items.map(key)).size !== items.length)
    invalid(path, "contains duplicate IDs");
  return items;
}

function code(value: unknown, path: string): number {
  const point = number(value, path, 1, 0x10ffff, true);
  if (point >= 0xd800 && point <= 0xdfff)
    invalid(path, "must be a Unicode scalar value");
  return point;
}

function characterKey(value: unknown, path: string): CharacterKey {
  const result = identifier(value, path);
  if (!/^(kanji|hiragana|katakana|radical):[1-9]\d*$/.test(result))
    invalid(path, "must be a character key");
  code(Number(result.split(":")[1]), path);
  return result as CharacterKey;
}

function favoriteKey(value: unknown, path: string): string {
  if (typeof value === "string" && /^(word|sentence):[1-9]\d*$/.test(value)) {
    number(Number(value.split(":")[1]), path, 1, Number.MAX_SAFE_INTEGER, true);
    return value;
  }
  return characterKey(value, path);
}

function rating(value: unknown, path: string): Rating {
  return number(value, path, 0, 3, true) as Rating;
}

function record<T>(
  value: unknown,
  parseKey: (key: unknown, path: string) => string,
  parseValue: (value: unknown, path: string) => T,
  path: string,
): Record<string, T> {
  const entries = Object.entries(object(value, path));
  if (entries.length > 100_000) invalid(path, "contains too many records");
  return Object.fromEntries(
    entries.map(([key, item]) => [
      parseKey(key, `${path} key`),
      parseValue(item, `${path}.${key}`),
    ]),
  );
}

function review(value: unknown, path: string): ReviewCard | null {
  if (value === null) return null;
  const item = object(value, path);
  return {
    due: number(item.due, `${path}.due`, 0, 8.64e15),
    interval: number(item.interval, `${path}.interval`, 0, 1_000_000),
    ease: number(item.ease, `${path}.ease`, 1.3, 3),
    repetitions: number(
      item.repetitions,
      `${path}.repetitions`,
      0,
      Number.MAX_SAFE_INTEGER,
      true,
    ),
    lapses: number(
      item.lapses,
      `${path}.lapses`,
      0,
      Number.MAX_SAFE_INTEGER,
      true,
    ),
  };
}

function progress(value: unknown, path: string): CharacterProgress {
  const item = object(value, path);
  const reviews = number(
    item.reviews,
    `${path}.reviews`,
    0,
    Number.MAX_SAFE_INTEGER,
    true,
  );
  const writingAttempts = number(
    item.writingAttempts,
    `${path}.writingAttempts`,
    0,
    reviews,
    true,
  );
  return {
    rating: rating(item.rating, `${path}.rating`),
    reviews,
    correct: number(item.correct, `${path}.correct`, 0, reviews, true),
    writingAttempts,
    writingCorrect: number(
      item.writingCorrect,
      `${path}.writingCorrect`,
      0,
      writingAttempts,
      true,
    ),
    timeMs: number(item.timeMs, `${path}.timeMs`),
    lastStudied: number(item.lastStudied, `${path}.lastStudied`, 0, 8.64e15),
    srs: review(item.srs, `${path}.srs`),
  };
}

function settings(value: unknown, path: string): Settings {
  const item = object(value, path);
  const reminderTime = text(item.reminderTime, `${path}.reminderTime`, 5);
  if (reminderTime !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime))
    invalid(`${path}.reminderTime`, "must be a valid HH:mm time or empty");
  return {
    theme: choice(item.theme, ["light", "dark", "system"], `${path}.theme`),
    dailyGoal: number(item.dailyGoal, `${path}.dailyGoal`, 1, 10_000, true),
    sessionSize: number(
      item.sessionSize,
      `${path}.sessionSize`,
      1,
      10_000,
      true,
    ),
    newPerDay: number(item.newPerDay, `${path}.newPerDay`, 0, 10_000, true),
    system: choice(item.system, systems, `${path}.system`),
    showFurigana: boolean(item.showFurigana, `${path}.showFurigana`),
    autoplayAudio: boolean(item.autoplayAudio, `${path}.autoplayAudio`),
    strokeSpeed: number(item.strokeSpeed, `${path}.strokeSpeed`, 0.1, 10),
    reminderTime,
    fontSize: choice(item.fontSize, ["normal", "large"], `${path}.fontSize`),
  };
}

function set(value: unknown, path: string): CustomSet {
  const item = object(value, path);
  return {
    id: identifier(item.id, `${path}.id`),
    name: identifier(item.name, `${path}.name`),
    description: text(item.description, `${path}.description`),
    keys: unique(
      array(item.keys, characterKey, `${path}.keys`),
      (key) => key,
      `${path}.keys`,
    ),
    createdAt: number(item.createdAt, `${path}.createdAt`, 0, 8.64e15),
    updatedAt: number(item.updatedAt, `${path}.updatedAt`, 0, 8.64e15),
  };
}

function event(value: unknown, path: string): StudyEvent {
  const item = object(value, path);
  return {
    id: identifier(item.id, `${path}.id`),
    at: number(item.at, `${path}.at`, 0, 8.64e15),
    key: characterKey(item.key, `${path}.key`),
    mode: choice(item.mode, modes, `${path}.mode`),
    correct: boolean(item.correct, `${path}.correct`),
    durationMs: number(item.durationMs, `${path}.durationMs`),
    ...(item.rating === undefined
      ? {}
      : { rating: rating(item.rating, `${path}.rating`) }),
  };
}

function config(value: unknown, path: string): StudyConfig {
  const item = object(value, path);
  return {
    mode: choice(item.mode, modes, `${path}.mode`),
    keys: unique(
      array(item.keys, characterKey, `${path}.keys`),
      (key) => key,
      `${path}.keys`,
    ),
    title: text(item.title, `${path}.title`, 1_000),
    size: number(item.size, `${path}.size`, 1, 100_000, true),
    shuffle: boolean(item.shuffle, `${path}.shuffle`),
    repeatMistakes: boolean(item.repeatMistakes, `${path}.repeatMistakes`),
    prompt: choice(
      item.prompt,
      [
        "meaning",
        "reading",
        "character",
        "word",
        "sentence",
        "kana",
        "kana-pair",
      ],
      `${path}.prompt`,
    ),
    writingMode: choice(
      item.writingMode,
      ["guided", "test", "self", "manual"],
      `${path}.writingMode`,
    ),
    guided: boolean(item.guided, `${path}.guided`),
    ...(item.writingStrictness === undefined
      ? {}
      : {
          writingStrictness: choice(
            item.writingStrictness,
            ["relaxed", "normal", "strict"] as const,
            `${path}.writingStrictness`,
          ),
        }),
    ...(item.writingHints === undefined
      ? {}
      : { writingHints: boolean(item.writingHints, `${path}.writingHints`) }),
    ...(item.quizTimerSeconds === undefined
      ? {}
      : {
          quizTimerSeconds: number(
            item.quizTimerSeconds,
            `${path}.quizTimerSeconds`,
            0,
            120,
            true,
          ),
        }),
    ...(item.hideAnswers === undefined
      ? {}
      : { hideAnswers: boolean(item.hideAnswers, `${path}.hideAnswers`) }),
    ...(item.autoAdvance === undefined
      ? {}
      : { autoAdvance: boolean(item.autoAdvance, `${path}.autoAdvance`) }),
  };
}

function session(value: unknown, path: string): SavedSession | null {
  if (value === null) return null;
  const item = object(value, path);
  const queue = array(item.queue, characterKey, `${path}.queue`);
  const answers = number(
    item.answers,
    `${path}.answers`,
    0,
    Number.MAX_SAFE_INTEGER,
    true,
  );
  return {
    config: config(item.config, `${path}.config`),
    queue,
    ...(item.sessionId === undefined
      ? {}
      : { sessionId: identifier(item.sessionId, `${path}.sessionId`) }),
    ...(item.mistakes === undefined
      ? {}
      : { mistakes: array(item.mistakes, characterKey, `${path}.mistakes`) }),
    index: number(item.index, `${path}.index`, 0, queue.length, true),
    correct: number(item.correct, `${path}.correct`, 0, answers, true),
    answers,
    startedAt: number(item.startedAt, `${path}.startedAt`, 0, 8.64e15),
  };
}

export function validateExtension(
  value: unknown,
  path = "extension",
): ExtensionPack {
  const item = object(value, path);
  if (item.schemaVersion !== 1) invalid(`${path}.schemaVersion`, "must be 1");
  return {
    schemaVersion: 1,
    id: identifier(item.id, `${path}.id`),
    name: identifier(item.name, `${path}.name`),
    author: identifier(item.author, `${path}.author`),
    license: identifier(item.license, `${path}.license`),
    readings: unique(
      array(
        item.readings,
        (value, path) => {
          const reading = object(value, path);
          return {
            id: identifier(reading.id, `${path}.id`),
            code: code(reading.code, `${path}.code`),
            text: text(reading.text, `${path}.text`),
            translation: text(reading.translation, `${path}.translation`),
          };
        },
        `${path}.readings`,
      ),
      (reading) => reading.id,
      `${path}.readings`,
    ),
    entries: unique(
      array(
        item.entries,
        (value, path) => {
          const entry = object(value, path);
          return {
            code: code(entry.code, `${path}.code`),
            explanation: text(entry.explanation, `${path}.explanation`),
            ...(entry.etymology === undefined
              ? {}
              : { etymology: text(entry.etymology, `${path}.etymology`) }),
          };
        },
        `${path}.entries`,
      ),
      (entry) => String(entry.code),
      `${path}.entries`,
    ),
  };
}

export function validateProfile(value: unknown): UserProfile {
  const item = object(value, "profile");
  if (item.schemaVersion !== 1) invalid("profile.schemaVersion", "must be 1");
  return {
    schemaVersion: 1,
    settings: settings(item.settings, "settings"),
    progress: record(item.progress, characterKey, progress, "progress"),
    favorites: unique(
      array(item.favorites, favoriteKey, "favorites"),
      (key) => key,
      "favorites",
    ),
    notes: record(item.notes, identifier, text, "notes"),
    overrides: record(
      item.overrides,
      identifier,
      (value, path) => {
        const override = object(value, path);
        return {
          ...(override.meaning === undefined
            ? {}
            : { meaning: text(override.meaning, `${path}.meaning`) }),
          ...(override.onReading === undefined
            ? {}
            : { onReading: text(override.onReading, `${path}.onReading`) }),
          ...(override.kunReading === undefined
            ? {}
            : { kunReading: text(override.kunReading, `${path}.kunReading`) }),
          ...(override.reading === undefined
            ? {}
            : { reading: text(override.reading, `${path}.reading`) }),
        };
      },
      "overrides",
    ),
    sets: unique(
      array(item.sets, set, "sets", 20_000),
      (set) => set.id,
      "sets",
    ),
    events: unique(
      array(item.events, event, "events", 500_000),
      (event) => event.id,
      "events",
    ),
    readingProgress: unique(
      array(item.readingProgress, identifier, "readingProgress"),
      (id) => id,
      "readingProgress",
    ),
    searchHistory: array(
      item.searchHistory,
      (value, path) => text(value, path, 1_000),
      "searchHistory",
      1_000,
    ),
    savedSession: session(item.savedSession, "savedSession"),
    extensions: unique(
      array(item.extensions, validateExtension, "extensions", 100),
      (extension) => extension.id,
      "extensions",
    ),
  };
}

export function parseImport(json: string): unknown {
  if (
    json.length > MAX_JSON_LENGTH ||
    new TextEncoder().encode(json).byteLength > MAX_JSON_LENGTH
  ) {
    throw new Error("Import is too large. The maximum JSON size is 20 MiB.");
  }
  try {
    return JSON.parse(json) as unknown;
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose a Kanji Study Web backup or extension file.",
    );
  }
}

export function parseBackup(json: string): UserProfile {
  const backup = object(parseImport(json), "backup");
  if (backup.app !== "kanji-study-web")
    invalid("backup.app", "must identify Kanji Study Web");
  if (backup.schemaVersion !== 1)
    invalid("backup.schemaVersion", "is not supported by this version");
  return validateProfile(backup.profile);
}
