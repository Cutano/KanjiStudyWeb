import { useEffect, useRef, useState } from "react";
import { BookOpen, Brain, Layers, PenLine, X } from "lucide-react";
import type {
  CharacterSummary,
  QuizPrompt,
  StudyConfig,
  StudyMode,
} from "../../domain/types";
import { useProfile } from "../../state/useProfile";
import "./study.css";

export const modes = [
  {
    id: "flashcards" as const,
    label: "Flashcards",
    detail: "Recall, reveal, and rate",
    icon: Layers,
  },
  {
    id: "quiz" as const,
    label: "Quick quiz",
    detail: "Connect meaning and reading",
    icon: Brain,
  },
  {
    id: "writing" as const,
    label: "Writing",
    detail: "Learn one stroke at a time",
    icon: PenLine,
  },
  {
    id: "reading" as const,
    label: "Reading",
    detail: "See kanji in context",
    icon: BookOpen,
  },
];
export const promptLabels: Record<QuizPrompt, string> = {
  meaning: "Meaning → character",
  reading: "Reading → character",
  character: "Character → meaning",
  word: "Vocabulary → missing character",
  sentence: "Sentence → missing character",
  kana: "Character → reading",
  "kana-pair": "Hiragana ↔ katakana",
};

export function StudySetup({
  items,
  title,
  onStart,
  onClose,
}: {
  items: CharacterSummary[];
  title: string;
  onStart: (config: StudyConfig) => void;
  onClose: () => void;
}) {
  const profile = useProfile();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  const [mode, setMode] = useState<StudyMode>("flashcards");
  const [size, setSize] = useState(
    Math.min(profile.settings.sessionSize, items.length),
  );
  const [shuffle, setShuffle] = useState(true);
  const [repeatMistakes, setRepeatMistakes] = useState(true);
  const [prompt, setPrompt] = useState<QuizPrompt>("meaning");
  const [writingMode, setWritingMode] =
    useState<StudyConfig["writingMode"]>("guided");
  const [quizTimerSeconds, setQuizTimerSeconds] = useState(0);
  const [hideAnswers, setHideAnswers] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [writingStrictness, setWritingStrictness] =
    useState<NonNullable<StudyConfig["writingStrictness"]>>("normal");
  const [writingHints, setWritingHints] = useState(true);
  const [rating, setRating] = useState("all");
  const [guided, setGuided] = useState(false);
  const filtered = items.filter(
    (item) =>
      rating === "all" ||
      (rating === "due"
        ? !!profile.progress[item.key]?.srs &&
          profile.progress[item.key].srs!.due <= Date.now()
        : (profile.progress[item.key]?.rating ?? 0) === Number(rating)),
  );
  return (
    <div
      className="study-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="study-setup"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-setup-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") {
            const controls = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]",
              ),
            ];
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <div>
            <p className="study-eyebrow">YOUR NEXT SESSION</p>
            <h2 id="study-setup-title">A little practice goes a long way.</h2>
            <p className="muted">
              {title} · {items.length} characters
            </p>
          </div>
          <button
            type="button"
            className="study-icon"
            aria-label="Close study setup"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="study-mode-grid">
          {modes.map(({ id, label, detail, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={mode === id ? "selected" : ""}
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
            >
              <Icon size={23} />
              <strong>{label}</strong>
              <span>{detail}</span>
            </button>
          ))}
        </div>
        <div className="study-form-grid">
          <label>
            Characters
            <select
              aria-label="Characters"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            >
              <option value="all">All ratings</option>
              <option value="0">New</option>
              <option value="1">Seen</option>
              <option value="2">Familiar</option>
              <option value="3">Known</option>
              <option value="due">Due for review</option>
            </select>
          </label>
          <label>
            Session size
            <input
              type="number"
              min="1"
              max={Math.max(1, filtered.length)}
              aria-label="Session size"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </label>
          {mode === "quiz" && (
            <label className="study-full">
              Question type
              <select
                aria-label="Question type"
                value={prompt}
                onChange={(event) =>
                  setPrompt(event.target.value as QuizPrompt)
                }
              >
                {Object.entries(promptLabels).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    disabled={
                      value === "kana-pair" &&
                      !items.some(
                        (item) =>
                          item.kind === "hiragana" || item.kind === "katakana",
                      )
                    }
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "writing" && (
            <label className="study-full">
              Writing style
              <select
                aria-label="Writing style"
                value={writingMode}
                onChange={(event) =>
                  setWritingMode(
                    event.target.value as StudyConfig["writingMode"],
                  )
                }
              >
                <option value="guided">
                  Guided tracing — visible stroke guides
                </option>
                <option value="test">From memory — hints when needed</option>
                <option value="manual">
                  Manual check — confirm each drawn stroke
                </option>
                <option value="self">Free writing — assess it yourself</option>
              </select>
            </label>
          )}
        </div>
        {(mode === "quiz" || mode === "writing") && (
          <details className="study-options">
            <summary>More practice options</summary>
            {mode === "quiz" ? (
              <>
                <label>
                  Base time per question
                  <select
                    aria-label="Base time per question"
                    value={quizTimerSeconds}
                    onChange={(event) =>
                      setQuizTimerSeconds(Number(event.target.value))
                    }
                  >
                    <option value={0}>No time limit</option>
                    {[5, 10, 20, 30].map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds} seconds
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted">
                  The timer allows up to 50% more time for characters you are
                  still learning.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={hideAnswers}
                    onChange={(event) => setHideAnswers(event.target.checked)}
                  />{" "}
                  Hide choices until I am ready
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(event) => setAutoAdvance(event.target.checked)}
                  />{" "}
                  Continue automatically after feedback
                </label>
              </>
            ) : (
              <>
                <label>
                  Stroke detection
                  <select
                    aria-label="Stroke detection"
                    value={writingStrictness}
                    onChange={(event) =>
                      setWritingStrictness(
                        event.target.value as NonNullable<
                          StudyConfig["writingStrictness"]
                        >,
                      )
                    }
                  >
                    <option value="relaxed">Relaxed</option>
                    <option value="normal">Normal</option>
                    <option value="strict">Strict</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={writingHints}
                    onChange={(event) => setWritingHints(event.target.checked)}
                  />{" "}
                  Show a hint after an incorrect stroke
                </label>
              </>
            )}
          </details>
        )}
        <div className="study-checks">
          <label>
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(event) => setShuffle(event.target.checked)}
            />{" "}
            Shuffle the order
          </label>
          <label>
            <input
              type="checkbox"
              checked={repeatMistakes}
              onChange={(event) => setRepeatMistakes(event.target.checked)}
            />{" "}
            Repeat missed characters once
          </label>
          <label>
            <input
              type="checkbox"
              checked={guided}
              onChange={(event) => setGuided(event.target.checked)}
            />{" "}
            Prioritize scheduled reviews
          </label>
        </div>
        {mode === "reading" && (
          <p className="study-note">
            Practice with the offline example sentences and any reading packs
            you have imported. Characters without sentences will be identified.
          </p>
        )}
        <footer>
          <span className="muted">{filtered.length} characters available</span>
          <button
            type="button"
            className="study-primary"
            disabled={filtered.length === 0 || size < 1}
            onClick={() =>
              onStart({
                mode,
                keys: filtered.map((item) => item.key),
                title,
                size: Math.min(filtered.length, Math.max(1, Math.floor(size))),
                shuffle,
                repeatMistakes,
                prompt,
                writingMode,
                writingStrictness,
                writingHints,
                quizTimerSeconds,
                hideAnswers,
                autoAdvance,
                guided,
              })
            }
          >
            Start {modes.find((item) => item.id === mode)?.label.toLowerCase()}
          </button>
        </footer>
      </section>
    </div>
  );
}
