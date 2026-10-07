import { useState } from "react";
import { BookOpen, Check, Clipboard } from "lucide-react";
import { catalog } from "../data/catalog";
import { plainSentence } from "../data/text";
import { useAsync } from "../lib/hooks";
import { useProfile } from "../state/useProfile";
import { updateProfile } from "../state/profile";
import {
  BackButton,
  CharacterCard,
  DeviceVoiceButton,
  ErrorNotice,
  FavoriteButton,
  Loading,
  WordRow,
} from "../components/common";
import { SentenceText } from "../components/SentenceText";

export function SentenceDetails({ id }: { id: number }) {
  const profile = useProfile();
  const result = useAsync(() => catalog.getSentenceDetail(id), [id]);
  const key = `sentence:${id}`;
  const [note, setNote] = useState(profile.notes[key] || "");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [divideWords, setDivideWords] = useState(false);
  const [error, setError] = useState("");
  if (result.loading) return <Loading label="Opening the example sentence…" />;
  const sentence = result.data;
  if (!sentence)
    return (
      <div className="page">
        <BackButton fallback="reading" />
        <ErrorNotice
          message={
            result.error || "This sentence is not in the installed catalog."
          }
        />
      </div>
    );
  const read = profile.readingProgress.includes(key);
  const words = sentence.vocabulary.filter(
    (item, index, all) =>
      all.findIndex((other) => other.word.id === item.word.id) === index,
  );
  return (
    <div className="page sentence-detail">
      <BackButton fallback="reading" />
      <div className="page-heading spaced-top">
        <div>
          <p className="eyebrow">JAPANESE IN CONTEXT</p>
          <h1>
            Example sentence<span className="accent-dot">.</span>
          </h1>
        </div>
        <div className="button-group">
          <FavoriteButton id={key} />
          <button
            className="icon-button"
            aria-label="Copy sentence"
            onClick={() =>
              navigator.clipboard
                .writeText(plainSentence(sentence.text))
                .then(() => setCopied(true))
                .catch((reason: Error) => setError(reason.message))
            }
          >
            {copied ? <Check /> : <Clipboard size={19} />}
          </button>
          <DeviceVoiceButton text={plainSentence(sentence.text)} />
        </div>
      </div>
      <ErrorNotice message={error} />
      <section className="sentence-focus" aria-label="Sentence and translation">
        <div className="sentence-options">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={profile.settings.showFurigana}
              onChange={(event) => {
                const checked = event.target.checked;
                updateProfile((draft) => {
                  draft.settings.showFurigana = checked;
                }).catch((reason: Error) => setError(reason.message));
              }}
            />
            Furigana
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={divideWords}
              onChange={(event) => setDivideWords(event.target.checked)}
            />
            Separate linked words
          </label>
        </div>
        <p className="sentence-detail-text">
          <SentenceText
            sentence={sentence}
            furigana={profile.settings.showFurigana}
            divideWords={divideWords}
          />
        </p>
        <p className="sentence-detail-translation">{sentence.translation}</p>
        <button
          className="text-button"
          onClick={() =>
            updateProfile((draft) => {
              draft.readingProgress = draft.readingProgress.includes(key)
                ? draft.readingProgress.filter((item) => item !== key)
                : [...draft.readingProgress, key];
            }).catch((reason: Error) => setError(reason.message))
          }
        >
          {read ? <Check size={16} /> : <BookOpen size={16} />}
          {read ? "Read" : "Mark as read"}
        </button>
      </section>
      <section className="detail-section">
        <h2>
          Words in this sentence{" "}
          <span className="section-count">{words.length}</span>
        </h2>
        {words.length ? (
          words.map(({ word }) => <WordRow key={word.id} word={word} />)
        ) : (
          <p className="muted">
            This example has no linked vocabulary in the source catalog.
          </p>
        )}
      </section>
      {sentence.characters.length > 0 && (
        <section className="detail-section">
          <h2>
            Kanji in this sentence{" "}
            <span className="section-count">{sentence.characters.length}</span>
          </h2>
          <div className="character-grid compact-grid">
            {sentence.characters.map((character) => (
              <CharacterCard item={character} key={character.key} />
            ))}
          </div>
        </section>
      )}
      <section className="note-panel">
        <h3>Your note</h3>
        <textarea
          aria-label="Sentence note"
          rows={3}
          value={note}
          placeholder="Save a translation note or grammar observation…"
          onChange={(event) => {
            setNote(event.target.value);
            setSaved(false);
          }}
        />
        <button
          className="text-button"
          onClick={() =>
            updateProfile((draft) => {
              draft.notes[key] = note;
            })
              .then(() => setSaved(true))
              .catch((reason: Error) => setError(reason.message))
          }
        >
          {saved ? <Check size={16} /> : <BookOpen size={16} />}
          {saved ? "Saved" : "Save note"}
        </button>
      </section>
    </div>
  );
}
