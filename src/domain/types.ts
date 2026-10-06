export type CharacterKind = "kanji" | "hiragana" | "katakana" | "radical";
export type CharacterKey = `${CharacterKind}:${number}`;
export type SequenceSystem =
  | "jouyou"
  | "jouyou_revised"
  | "jlpt"
  | "jlpt_revised"
  | "heisig"
  | "heisig_revised"
  | "kanken"
  | "kanken_revised"
  | "kklc"
  | "freq"
  | "hadamitzky"
  | "kic";

export interface CharacterSummary {
  key: CharacterKey;
  kind: CharacterKind;
  code: number;
  glyph: string;
  meaning: string;
  onReading: string;
  kunReading: string;
  reading: string;
  strokeCount: number;
  level: number;
  sequence: number;
}

export interface CharacterDetail extends CharacterSummary {
  paths: string[];
  components: {
    code: number;
    key: CharacterKey | null;
    glyph: string;
    meaning: string;
    occurrences: number;
  }[];
  decomposition: string;
  classicalRadical: string;
  nanori: string;
  pinyin: string;
  korean: string;
  koreanRomanized: string;
  vietnamese: string;
  variants: string;
  variantOf: string;
  kangxiNumber: number | null;
  kangxiBase: string;
  radicalPosition: number | null;
  isImportant: boolean;
  isArchaic: boolean;
  isDiacritic: boolean;
  origin: string;
  example: string;
  isKokuji: boolean;
  isPhantom: boolean;
  sequences: Partial<
    Record<SequenceSystem, { level: number; sequence: number }>
  >;
}

export interface Page<T> {
  items: T[];
  total: number;
}
export interface CharacterQuery {
  kind?: CharacterKind;
  system?: SequenceSystem;
  level?: number;
  query?: string;
  components?: number[];
  strokeCount?: number;
  keys?: CharacterKey[];
  offset?: number;
  limit?: number;
}
export interface Vocabulary {
  id: number;
  entry: string;
  entryTemplate: string;
  readings: string;
  meanings: string;
  meaningsTemplate: string;
  tags: string;
  isCommon: boolean;
  jlptLevel: number;
  audio: string;
}
export interface Sentence {
  id: number;
  text: string;
  translation: string;
}
export interface ProperName {
  id: number;
  name: string;
  reading: string;
  type: string;
}
export interface VocabularyDetail extends Vocabulary {
  characters: CharacterSummary[];
  sentences: Sentence[];
  references: Vocabulary[];
}
export interface CatalogStats {
  kanji: number;
  kana: number;
  radicals: number;
  vocabulary: number;
  names: number;
  sentences: number;
  audio: number;
}
export interface InstallProgress {
  phase: string;
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

export type StudyMode = "flashcards" | "quiz" | "writing" | "reading";
export type QuizPrompt =
  | "meaning"
  | "reading"
  | "character"
  | "word"
  | "sentence"
  | "kana"
  | "kana-pair";
export type Rating = 0 | 1 | 2 | 3;
export interface StudyConfig {
  mode: StudyMode;
  keys: CharacterKey[];
  title: string;
  size: number;
  shuffle: boolean;
  repeatMistakes: boolean;
  prompt: QuizPrompt;
  writingMode: "guided" | "test" | "manual" | "self";
  writingStrictness?: "relaxed" | "normal" | "strict";
  writingHints?: boolean;
  quizTimerSeconds?: number;
  hideAnswers?: boolean;
  autoAdvance?: boolean;
  guided: boolean;
}
export interface ReviewCard {
  due: number;
  interval: number;
  ease: number;
  repetitions: number;
  lapses: number;
}
export interface CharacterProgress {
  rating: Rating;
  reviews: number;
  correct: number;
  writingAttempts: number;
  writingCorrect: number;
  timeMs: number;
  lastStudied: number;
  srs: ReviewCard | null;
}
export interface CustomSet {
  id: string;
  name: string;
  description: string;
  keys: CharacterKey[];
  createdAt: number;
  updatedAt: number;
}
export interface StudyEvent {
  id: string;
  at: number;
  key: CharacterKey;
  mode: StudyMode;
  correct: boolean;
  durationMs: number;
  rating?: Rating;
}
export interface SavedSession {
  sessionId?: string;
  mistakes?: CharacterKey[];
  config: StudyConfig;
  index: number;
  queue: CharacterKey[];
  correct: number;
  answers: number;
  startedAt: number;
}
export interface Settings {
  theme: "light" | "dark" | "system";
  dailyGoal: number;
  sessionSize: number;
  newPerDay: number;
  system: SequenceSystem;
  showFurigana: boolean;
  autoplayAudio: boolean;
  strokeSpeed: number;
  reminderTime: string;
  fontSize: "normal" | "large";
}
export interface ExtensionReading {
  id: string;
  code: number;
  text: string;
  translation: string;
}
export interface ExtensionEntry {
  code: number;
  explanation: string;
  etymology?: string;
}
export interface ExtensionPack {
  schemaVersion: 1;
  id: string;
  name: string;
  author: string;
  license: string;
  readings: ExtensionReading[];
  entries: ExtensionEntry[];
}
export interface UserProfile {
  schemaVersion: 1;
  settings: Settings;
  progress: Record<string, CharacterProgress>;
  favorites: string[];
  notes: Record<string, string>;
  overrides: Record<
    string,
    {
      meaning?: string;
      onReading?: string;
      kunReading?: string;
      reading?: string;
    }
  >;
  sets: CustomSet[];
  events: StudyEvent[];
  readingProgress: string[];
  searchHistory: string[];
  savedSession: SavedSession | null;
  extensions: ExtensionPack[];
}
