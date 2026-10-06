import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import type {
  CharacterDetail,
  CharacterSummary,
  Rating,
  SavedSession,
  Sentence,
  StudyConfig,
  Vocabulary,
} from "../../domain/types";
import { recordStudy } from "../../domain/study";
import { catalog } from "../../data/catalog";
import { getProfile, updateProfile } from "../../state/profile";
import { useProfile } from "../../state/useProfile";
import { ErrorNotice, Loading } from "../../components/common";
import { makeQuestion } from "./quiz";
import { applyStudyOverrides } from "./customization";
import {
  advanceSession,
  assertSessionCheckpoint,
  createSession,
  questionRandom,
} from "./session";
import { modes } from "./StudySetup";
import { FlashcardStudy } from "./FlashcardStudy";
import { QuizStudy } from "./QuizStudy";
import { WritingStudy } from "./WritingStudy";
import { ReadingStudy, type ReadingItem } from "./ReadingStudy";
import "./study.css";

interface StudyData {
  character: CharacterDetail;
  words: Vocabulary[];
  sentences: Sentence[];
  candidates: CharacterSummary[];
}
export function StudySession({
  config,
  onExit,
}: {
  config: StudyConfig;
  onExit: () => void;
}) {
  const profile = useProfile();
  const [session, setSession] = useState<SavedSession>(() =>
    createSession(config, getProfile()),
  );
  const initialCheckpoint = useRef(getProfile().savedSession);
  const [data, setData] = useState<StudyData>();
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [readingIndex, setReadingIndex] = useState(0);
  const [sentenceFurigana, setSentenceFurigana] = useState(
    profile.settings.showFurigana,
  );
  const started = useRef(Date.now());
  const index = preview ?? session.index;
  const key = session.queue[index];
  const done = session.index >= session.queue.length;
  const dataKey = data?.character.key;

  useEffect(() => {
    updateProfile((draft) => {
      // A repeated mount effect may see its own initial write. Any other
      // checkpoint must still match the state from which this session opened.
      assertSessionCheckpoint(
        draft.savedSession,
        draft.savedSession?.sessionId === session.sessionId
          ? session
          : initialCheckpoint.current,
      );
      draft.savedSession = session.queue.length ? session : null;
    }).catch((reason: Error) => setError(reason.message));
    // Initial persistence allows leaving via browser navigation before any answer.
  }, []);

  useEffect(() => {
    if (!key || done) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setRevealed(false);
    setSelected(null);
    setReadingIndex(0);
    Promise.all([
      catalog.getCharacter(key),
      catalog.getCharacterVocabulary(key, { limit: 8 }),
      catalog.getCharacterSentences(key, { limit: 20 }),
      catalog.getCharacters({
        kind: key.split(":")[0] as CharacterSummary["kind"],
        limit: 100,
      }),
    ])
      .then(([character, words, sentences, candidates]) => {
        if (!active) return;
        setData({
          character,
          words: words.items,
          sentences: sentences.items,
          candidates: candidates.items,
        });
        started.current = Date.now();
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, done, session.index, retry]);

  const character = useMemo(
    () =>
      data ? applyStudyOverrides(data.character, profile.overrides) : undefined,
    [data, profile.overrides],
  );
  const question = useMemo(
    () =>
      character && data
        ? makeQuestion(
            character,
            data.candidates.map((item) =>
              applyStudyOverrides(item, profile.overrides),
            ),
            config.prompt,
            data.words,
            data.sentences,
            questionRandom(`${session.sessionId}:${index}`),
          )
        : undefined,
    [
      character,
      data,
      config.prompt,
      profile.overrides,
      session.sessionId,
      index,
    ],
  );
  const readings: ReadingItem[] = useMemo(() => {
    if (!data) return [];
    const local = data.sentences.map((sentence) => ({
      ...sentence,
      id: `sentence:${sentence.id}`,
      source: "Example sentence",
    }));
    const extensions = profile.extensions.flatMap((pack) =>
      pack.readings
        .filter((item) => item.code === data.character.code)
        .map((item) => ({
          ...item,
          id: `${pack.id}:${item.id}`,
          source: pack.name,
        })),
    );
    return [...extensions, ...local].sort(
      (a, b) =>
        Number(profile.readingProgress.includes(a.id)) -
        Number(profile.readingProgress.includes(b.id)),
    );
  }, [data, profile.extensions, profile.readingProgress]);
  const reading = readings[readingIndex];

  async function answer(
    correct: boolean,
    rating?: Rating,
    readingId?: string,
    skip = false,
  ) {
    if (busy.current || !key || preview !== null) return;
    busy.current = true;
    setSaving(true);
    setError("");
    const next = advanceSession(session, correct, skip);
    try {
      await updateProfile((draft) => {
        assertSessionCheckpoint(draft.savedSession, session);
        if (!skip)
          recordStudy(
            draft,
            {
              id: `${session.sessionId}:${session.index}`,
              at: Date.now(),
              key,
              mode: config.mode,
              correct,
              durationMs: Math.max(
                0,
                Math.min(Date.now() - started.current, 30 * 60_000),
              ),
              rating,
            },
            rating ?? (correct ? 2 : 0),
          );
        if (readingId && !draft.readingProgress.includes(readingId))
          draft.readingProgress.push(readingId);
        draft.savedSession = next.index < next.queue.length ? next : null;
      });
      setSession(next);
      setRevealed(false);
      setSelected(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Progress could not be saved. Try again.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function saveAndExit() {
    if (busy.current) return;
    if (done) {
      onExit();
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await updateProfile((draft) => {
        assertSessionCheckpoint(draft.savedSession, session);
        draft.savedSession = session;
      });
      onExit();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Session could not be saved.",
      );
      busy.current = false;
      setSaving(false);
    }
  }
  async function restart(mistakesOnly = false) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    const repeatConfig = {
      ...config,
      keys: mistakesOnly ? session.mistakes || [] : config.keys,
      size: mistakesOnly ? session.mistakes?.length || 0 : config.size,
    };
    try {
      const next = createSession(repeatConfig, {
        ...getProfile(),
        savedSession: null,
      });
      await updateProfile((draft) => {
        draft.savedSession = next;
      });
      setSession(next);
      setPreview(null);
      setData(undefined);
      setRevealed(false);
      setSelected(null);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.matches(
          "input,textarea,select,button,a",
        ) ||
        loading ||
        saving ||
        done ||
        preview !== null
      )
        return;
      if (
        config.mode === "flashcards" &&
        (event.key === " " || event.key === "Enter") &&
        !revealed
      ) {
        event.preventDefault();
        setRevealed(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    config.mode,
    loading,
    saving,
    done,
    revealed,
    question,
    selected,
    preview,
  ]);

  const mode = modes.find((value) => value.id === config.mode)!;
  const ModeIcon = mode.icon;
  const header = (
    <header className="study-session-header">
      <button
        type="button"
        className="study-link"
        onClick={saveAndExit}
        disabled={saving}
      >
        <ArrowLeft size={18} />
        <span>Save & exit</span>
      </button>
      <span>
        <ModeIcon size={18} /> {mode.label}
      </span>
      <button
        type="button"
        className="study-icon"
        aria-label="Save session and close"
        onClick={saveAndExit}
        disabled={saving}
      >
        <X size={20} />
      </button>
    </header>
  );

  if (done)
    return (
      <section className="study-session">
        {header}
        <div className="study-result">
          <span className="study-result-icon">
            <CheckCircle2 size={46} />
          </span>
          <p className="study-eyebrow">SESSION COMPLETE</p>
          <h1>A little more familiar.</h1>
          <p className="muted">Every encounter makes the next one easier.</p>
          <div className="study-result-stats">
            <div>
              <strong>{session.answers}</strong>
              <span>practiced</span>
            </div>
            <div>
              <strong>
                {session.answers
                  ? Math.round((session.correct / session.answers) * 100)
                  : 0}
                %
              </strong>
              <span>recalled</span>
            </div>
            <div>
              <strong>
                {Math.max(
                  1,
                  Math.round((Date.now() - session.startedAt) / 60_000),
                )}
              </strong>
              <span>minutes</span>
            </div>
          </div>
          <ErrorNotice message={error} />
          <div className="study-result-actions">
            <button className="study-primary" onClick={onExit}>
              Back to my learning <ArrowRight size={17} />
            </button>
            <button
              onClick={() =>
                restart().catch((reason: Error) => setError(reason.message))
              }
            >
              <RotateCcw size={17} /> Study again
            </button>
            {!!session.mistakes?.length && (
              <button
                onClick={() =>
                  restart(true).catch((reason: Error) =>
                    setError(reason.message),
                  )
                }
              >
                Review {session.mistakes.length} missed characters
              </button>
            )}
          </div>
          <p className="study-saved">
            <Check size={15} /> Your progress is saved on this device.
          </p>
        </div>
      </section>
    );

  return (
    <section className="study-session">
      {header}
      <div className="study-progress">
        <div>
          <span>{config.title}</span>
          <strong>
            {session.index + 1} / {session.queue.length}
          </strong>
        </div>
        <progress
          max={session.queue.length}
          value={session.index}
          aria-label="Session progress"
        />
      </div>
      <ErrorNotice message={error} />
      {loading || !data || !character || dataKey !== key ? (
        error && !loading ? (
          <div className="study-no-content">
            <button
              className="study-primary"
              onClick={() => setRetry(retry + 1)}
            >
              Retry loading this character
            </button>
          </div>
        ) : (
          <Loading label="Preparing your next character…" />
        )
      ) : (
        <>
          {preview !== null && (
            <div className="study-preview-note">
              Reviewing an earlier card. This does not change your score.
              <button onClick={() => setPreview(null)}>
                Continue session <ArrowRight size={16} />
              </button>
            </div>
          )}
          {config.mode === "flashcards" && (
            <FlashcardStudy
              character={character}
              words={data.words}
              profile={profile}
              revealed={revealed}
              setRevealed={setRevealed}
              saving={saving}
              preview={preview}
              setPreview={setPreview}
              index={index}
              currentIndex={session.index}
              answer={answer}
            />
          )}
          {config.mode === "quiz" && question && (
            <QuizStudy
              character={character}
              key={`${session.sessionId}-${session.index}`}
              prompt={config.prompt}
              timerSeconds={
                (config.quizTimerSeconds || 0) *
                (1.5 -
                  0.5 *
                    ((profile.progress[character.key]?.correct || 0) /
                      Math.max(
                        1,
                        profile.progress[character.key]?.reviews || 0,
                      )))
              }
              hideAnswers={config.hideAnswers}
              autoAdvance={config.autoAdvance}
              question={question}
              selected={selected}
              setSelected={setSelected}
              saving={saving}
              answer={answer}
            />
          )}
          {config.mode === "writing" && (
            <WritingStudy
              character={character}
              writingMode={config.writingMode}
              strokeSpeed={profile.settings.strokeSpeed}
              strictness={config.writingStrictness}
              showHints={config.writingHints}
              identity={`${session.sessionId}-${session.index}`}
              saving={saving}
              answer={answer}
            />
          )}
          {config.mode === "reading" && (
            <ReadingStudy
              character={character}
              words={data.words}
              reading={reading}
              readingCount={readings.length}
              readingIndex={readingIndex}
              setReadingIndex={setReadingIndex}
              revealed={revealed}
              setRevealed={setRevealed}
              sentenceFurigana={sentenceFurigana}
              setSentenceFurigana={setSentenceFurigana}
              saving={saving}
              answer={answer}
            />
          )}
          <p className="study-saved">
            <Save size={14} />{" "}
            {saving
              ? "Saving your progress…"
              : "Each completed answer is saved automatically."}
          </p>
        </>
      )}
    </section>
  );
}
