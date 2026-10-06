import { makeStudyQueue } from "../../domain/study";
import type {
  CharacterKey,
  SavedSession,
  StudyConfig,
  UserProfile,
} from "../../domain/types";

/** Compare inside the profile transaction before replacing a saved checkpoint. */
export function assertSessionCheckpoint(
  current: SavedSession | null,
  expected: SavedSession | null,
): void {
  if (
    current?.sessionId !== expected?.sessionId ||
    current?.index !== expected?.index ||
    current?.startedAt !== expected?.startedAt
  )
    throw new Error(
      "This session changed in another tab. Reload to resume your latest progress.",
    );
}

export function createSession(
  config: StudyConfig,
  profile: UserProfile,
  now = Date.now(),
  id: string = crypto.randomUUID(),
): SavedSession {
  const existing = profile.savedSession;
  if (
    existing &&
    JSON.stringify(existing.config) === JSON.stringify(config) &&
    existing.index < existing.queue.length
  ) {
    return {
      ...existing,
      sessionId: existing.sessionId || id,
      mistakes: existing.mistakes || [],
    };
  }
  const queue = makeStudyQueue(
    config.keys,
    config.guided ? config.keys.length : config.size,
    config.shuffle,
  );
  if (config.guided)
    queue.sort(
      (a, b) =>
        (profile.progress[a]?.srs?.due ?? Infinity) -
        (profile.progress[b]?.srs?.due ?? Infinity),
    );
  return {
    config,
    queue: queue.slice(0, config.size),
    index: 0,
    correct: 0,
    answers: 0,
    startedAt: now,
    sessionId: id,
    mistakes: [],
  };
}

/** Append one extra encounter per missed character, never an unbounded retry loop. */
export function advanceSession(
  session: SavedSession,
  correct: boolean,
  skip = false,
): SavedSession {
  const key: CharacterKey = session.queue[session.index];
  const next: SavedSession = {
    ...session,
    queue: [...session.queue],
    index: session.index + 1,
    answers: session.answers + Number(!skip),
    correct: session.correct + Number(correct && !skip),
    mistakes: [...(session.mistakes || [])],
  };
  if (!correct && !skip) {
    if (!next.mistakes!.includes(key)) next.mistakes!.push(key);
    if (
      session.config.repeatMistakes &&
      session.queue.filter((value) => value === key).length < 2
    )
      next.queue.push(key);
  }
  return next;
}

/** Stable question choices do not reshuffle when a favorite or setting is saved. */
export function questionRandom(identity: string): () => number {
  let state = 2166136261;
  for (const character of identity)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}
