import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, LoaderCircle, Star, X } from "lucide-react";
import type { CharacterSummary, Vocabulary } from "../domain/types";
import { cleanReading, parseSentence, vocabularyLabel } from "../data/text";
import { VocabularyMeanings } from "./VocabularyMeanings";
import { updateProfile } from "../state/profile";
import { useProfile } from "../state/useProfile";
import { WordAudioButton } from "./PronunciationButton";
export { WordAudioButton, SpeechButton } from "./PronunciationButton";

export function Loading({
  label = "Opening your library…",
}: {
  label?: string;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={25} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="notice error">
      <AlertCircle size={18} />
      {message}
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-glyph">空</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const previous = opener.current;
    const focused = dialog.current?.querySelector<HTMLElement>(
      "input, textarea, button, select, a[href]",
    );
    focused?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            const controls = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]",
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
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function BackButton({ fallback = "library" }: { fallback?: string }) {
  return (
    <button
      className="text-button"
      onClick={() =>
        history.length > 1 ? history.back() : location.assign(`#${fallback}`)
      }
    >
      <ArrowLeft size={17} />
      Back to browsing
    </button>
  );
}
export function FavoriteButton({ id }: { id: string }) {
  const profile = useProfile();
  const selected = profile.favorites.includes(id);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className={`icon-button favorite ${selected ? "selected" : ""}`}
        aria-label={selected ? "Remove favorite" : "Add favorite"}
        aria-pressed={selected}
        onClick={() =>
          updateProfile((draft) => {
            draft.favorites = draft.favorites.includes(id)
              ? draft.favorites.filter((key) => key !== id)
              : [...draft.favorites, id];
          }).catch((reason: Error) => setError(reason.message))
        }
      >
        <Star size={19} fill={selected ? "currentColor" : "none"} />
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
export function CharacterCard({
  item,
  selected,
  onSelect,
}: {
  item: CharacterSummary;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const profile = useProfile();
  const rating = profile.progress[item.key]?.rating || 0;
  return (
    <article className={`character-card ${selected ? "is-selected" : ""}`}>
      <div className="card-top">
        <span
          className={`rating-dot rating-${rating}`}
          title={["New", "Learning", "Familiar", "Known"][rating]}
        />
        {onSelect ? (
          <input
            type="checkbox"
            aria-label={`Select ${item.glyph}`}
            checked={selected}
            onChange={onSelect}
          />
        ) : (
          <FavoriteButton id={item.key} />
        )}
      </div>
      <a className="character-link" href={`#character/${item.key}`}>
        <span lang="ja" className="character-glyph">
          {item.glyph}
        </span>
        <span className="character-meaning">
          {profile.overrides[item.key]?.meaning ||
            item.meaning ||
            item.reading ||
            "No meaning recorded"}
        </span>
        <span lang="ja" className="character-reading">
          {cleanReading(item.onReading || item.kunReading || item.reading)}
        </span>
      </a>
      <div className="card-bottom">
        <span>{item.strokeCount} strokes</span>
        <span>{String(item.sequence).padStart(3, "0")}</span>
      </div>
    </article>
  );
}
export function WordRow({ word }: { word: Vocabulary }) {
  return (
    <article className="word-row">
      <div className="word-main">
        <a href={`#word/${word.id}`} lang="ja">
          {vocabularyLabel(word)}
        </a>
        <span lang="ja" className="muted">
          {word.readings.split(";")[0]}
        </span>
        <VocabularyMeanings word={word} compact />
      </div>
      <div className="word-actions">
        {(word.isCommon || word.jlptLevel > 0) && (
          <div className="word-tags">
            {word.isCommon && <span className="badge">Common</span>}
            {word.jlptLevel > 0 && (
              <span className="tag">N{word.jlptLevel}</span>
            )}
          </div>
        )}
        <div className="word-buttons">
          <WordAudioButton word={word} />
          <FavoriteButton id={`word:${word.id}`} />
        </div>
      </div>
    </article>
  );
}
export function JapaneseSentence({
  text,
  furigana = true,
  linked = true,
}: {
  text: string;
  furigana?: boolean;
  linked?: boolean;
}) {
  const glyphs = (value: string) =>
    [...value].map((glyph, index) =>
      linked && /\p{Script=Han}/u.test(glyph) ? (
        <a
          className="sentence-character"
          key={index}
          href={`#character/kanji:${glyph.codePointAt(0)}`}
          aria-label={`Look up ${glyph}`}
        >
          {glyph}
        </a>
      ) : (
        glyph
      ),
    );
  return (
    <span lang="ja">
      {parseSentence(text).map((part, index) =>
        part.reading && furigana ? (
          <ruby key={index}>
            {glyphs(part.text)}
            <rt>{part.reading}</rt>
          </ruby>
        ) : (
          <span key={index}>{glyphs(part.text)}</span>
        ),
      )}
    </span>
  );
}
