import type { CharacterKey, CharacterProgress, Rating, ReviewCard, StudyEvent, UserProfile } from './types';

const DAY_MS = 86_400_000;

export function createDefaultProfile(): UserProfile {
  return {
    schemaVersion: 1,
    settings: {
      theme: 'system', dailyGoal: 20, sessionSize: 10, newPerDay: 5,
      system: 'jouyou_revised', showFurigana: true, autoplayAudio: false,
      strokeSpeed: 1, reminderTime: '', fontSize: 'normal',
    },
    progress: {}, favorites: [], notes: {}, overrides: {}, sets: [], events: [],
    readingProgress: [], searchHistory: [], savedSession: null, extensions: [],
  };
}

export function createCharacterProgress(): CharacterProgress {
  return {
    rating: 0, reviews: 0, correct: 0, writingAttempts: 0, writingCorrect: 0,
    timeMs: 0, lastStudied: 0, srs: null,
  };
}

/** A transparent SM-2-inspired schedule, not a claim about the Android algorithm.
 * Again: 10 minutes; Hard: at least 1 day; Good: 1 then 3 days; Easy: at least 4 days.
 * Later successful intervals grow by ease. All stored intervals are days.
 */
export function scheduleReview(card: ReviewCard | null, grade: Rating, now: number): ReviewCard {
  const previous = card ?? { due: now, interval: 0, ease: 2.5, repetitions: 0, lapses: 0 };
  if (grade === 0) {
    return {
      due: now + 10 * 60_000, interval: 10 / 1_440,
      ease: Math.max(1.3, previous.ease - 0.2), repetitions: 0, lapses: previous.lapses + 1,
    };
  }
  const ease = Math.min(3, Math.max(1.3, previous.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0)));
  let interval: number;
  if (grade === 1) interval = Math.max(1, Math.round(previous.interval * 1.2));
  else if (grade === 3) interval = Math.max(4, Math.round(previous.interval * ease * 1.3));
  else if (previous.repetitions === 0) interval = 1;
  else if (previous.repetitions === 1) interval = 3;
  else interval = Math.max(1, Math.round(previous.interval * ease));
  return { due: now + interval * DAY_MS, interval, ease, repetitions: previous.repetitions + 1, lapses: previous.lapses };
}

/** Mutate only a transaction's draft. Stable event IDs make repeated submissions harmless. */
export function recordStudy(profile: UserProfile, event: StudyEvent, reviewGrade?: Rating): void {
  if (profile.events.some((previous) => previous.id === event.id)) return;
  const progress = profile.progress[event.key] ?? createCharacterProgress();
  progress.reviews += 1;
  progress.correct += Number(event.correct);
  progress.timeMs += event.durationMs;
  progress.lastStudied = Math.max(progress.lastStudied, event.at);
  if (event.mode === 'writing') {
    progress.writingAttempts += 1;
    progress.writingCorrect += Number(event.correct);
  }
  if (event.rating !== undefined) progress.rating = event.rating;
  else if (progress.rating === 0) progress.rating = 1;
  progress.srs = scheduleReview(progress.srs, reviewGrade ?? (event.correct ? 2 : 0), event.at);
  profile.progress[event.key] = progress;
  profile.events.push({ ...event });
}

export function makeStudyQueue(
  keys: readonly CharacterKey[], size: number, shuffle: boolean, random: () => number = Math.random,
): CharacterKey[] {
  const queue = [...new Set(keys)];
  if (shuffle) {
    for (let index = queue.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [queue[index], queue[other]] = [queue[other]!, queue[index]!];
    }
  }
  return queue.slice(0, Math.max(0, Math.floor(size)));
}

export function localDayKey(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayOffset(now: number, offset: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  return localDayKey(date.getTime());
}

/** Count the first review of each character once, across every session and mode. */
export function getDailyNewAllowance(profile: UserProfile, now: number = Date.now()): number {
  const firstReviews = new Map<CharacterKey, number>();
  for (const event of profile.events) {
    const previous = firstReviews.get(event.key);
    if (previous === undefined || event.at < previous) firstReviews.set(event.key, event.at);
  }
  const today = localDayKey(now);
  const introducedToday = [...firstReviews.values()].filter((at) => localDayKey(at) === today).length;
  return Math.max(0, profile.settings.newPerDay - introducedToday);
}

export function statistics(profile: UserProfile, now: number = Date.now()) {
  const today = localDayKey(now);
  const daily = new Map<string, { reviews: number; correct: number; timeMs: number }>();
  const modeCounts = { flashcards: 0, quiz: 0, writing: 0, reading: 0 };
  let totalCorrect = 0;
  let totalTimeMs = 0;
  for (const event of profile.events) {
    const day = localDayKey(event.at);
    const activity = daily.get(day) ?? { reviews: 0, correct: 0, timeMs: 0 };
    activity.reviews += 1;
    activity.correct += Number(event.correct);
    activity.timeMs += event.durationMs;
    daily.set(day, activity);
    modeCounts[event.mode] += 1;
    totalCorrect += Number(event.correct);
    totalTimeMs += event.durationMs;
  }
  const todayActivity = daily.get(today) ?? { reviews: 0, correct: 0, timeMs: 0 };
  const ratingCounts: [number, number, number, number] = [0, 0, 0, 0];
  let due = 0;
  for (const progress of Object.values(profile.progress)) {
    ratingCounts[progress.rating] += 1;
    if (progress.srs && progress.srs.due <= now) due += 1;
  }
  let streak = 0;
  let offset = daily.has(today) ? 0 : -1;
  while (daily.has(dayOffset(now, offset))) {
    streak += 1;
    offset -= 1;
  }
  return {
    todayReviews: todayActivity.reviews,
    todayCorrect: todayActivity.correct,
    todayTimeMs: todayActivity.timeMs,
    totalReviews: profile.events.length,
    totalCorrect, totalTimeMs,
    accuracy: profile.events.length ? Math.round(100 * totalCorrect / profile.events.length) : 0,
    studied: Object.values(profile.progress).filter((progress) => progress.reviews > 0).length,
    learned: ratingCounts[3], due, streak, ratingCounts, modeCounts,
    last7Days: Array.from({ length: 7 }, (_, index) => {
      const day = dayOffset(now, index - 6);
      return { day, ...(daily.get(day) ?? { reviews: 0, correct: 0, timeMs: 0 }) };
    }),
  };
}
