import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { CharacterDetail, Rating, Vocabulary } from "../../domain/types";
import { vocabularyLabel, vocabularyMeaning } from "../../data/text";
import { WordAudioButton, JapaneseSentence } from "../../components/common";
export interface ReadingItem {
  id: string;
  text: string;
  translation: string;
  source: string;
}
interface Props {
  character: CharacterDetail;
  words: Vocabulary[];
  reading?: ReadingItem;
  readingCount: number;
  readingIndex: number;
  setReadingIndex: (value: number) => void;
  revealed: boolean;
  setRevealed: (value: boolean) => void;
  sentenceFurigana: boolean;
  setSentenceFurigana: (value: boolean) => void;
  saving: boolean;
  answer: (
    correct: boolean,
    rating?: Rating,
    readingId?: string,
    skip?: boolean,
  ) => Promise<void>;
}
export function ReadingStudy({
  character,
  words,
  reading,
  readingCount,
  readingIndex,
  setReadingIndex,
  revealed,
  setRevealed,
  sentenceFurigana,
  setSentenceFurigana,
  saving,
  answer,
}: Props) {
  return (
    <div className="reading-layout">
      <div className="reading-top">
        <span className="reading-target" lang="ja">
          {character.glyph}
        </span>
        <div>
          <p className="study-eyebrow">READ IN CONTEXT</p>
          <h2>{character.meaning}</h2>
        </div>
        <label>
          <input
            type="checkbox"
            checked={sentenceFurigana}
            onChange={(event) => setSentenceFurigana(event.target.checked)}
          />{" "}
          Furigana
        </label>
      </div>
      {reading ? (
        <>
          <article className="study-reading-card">
            <div className="reading-source">
              <span>{reading.source}</span>
              <span>
                {readingIndex + 1} / {readingCount}
              </span>
            </div>
            <p className="reading-sentence">
              <JapaneseSentence
                text={reading.text}
                furigana={sentenceFurigana}
              />
            </p>
            {revealed ? (
              <p className="reading-translation">{reading.translation}</p>
            ) : (
              <button
                className="study-reveal"
                onClick={() => setRevealed(true)}
              >
                Reveal translation
              </button>
            )}
            <div className="reading-sentence-nav">
              <button
                disabled={readingIndex === 0}
                onClick={() => {
                  setReadingIndex(readingIndex - 1);
                  setRevealed(false);
                }}
              >
                <ChevronLeft size={18} /> Previous example
              </button>
              <button
                disabled={readingIndex >= readingCount - 1}
                onClick={() => {
                  setReadingIndex(readingIndex + 1);
                  setRevealed(false);
                }}
              >
                Next example <ChevronRight size={18} />
              </button>
            </div>
          </article>
          <div className="study-rating-pair">
            <button disabled={saving} onClick={() => answer(false)}>
              Read it again later
            </button>
            <button
              className="study-primary"
              disabled={saving}
              onClick={() => answer(true, undefined, reading.id)}
            >
              Understood <Check size={18} />
            </button>
          </div>
        </>
      ) : (
        <div className="study-no-content">
          <span className="empty-glyph" aria-hidden="true">
            文
          </span>
          <h3>No linked sentences for this character.</h3>
          <p className="muted">
            You can explore its vocabulary below or add a reading extension in
            Settings.
          </p>
          <button
            className="study-primary"
            disabled={saving}
            onClick={() => answer(false, undefined, undefined, true)}
          >
            Continue to next character
          </button>
        </div>
      )}
      {words.length > 0 && (
        <details className="reading-vocabulary">
          <summary>Explore related vocabulary ({words.length})</summary>
          {words.map((word) => (
            <div className="study-word" key={word.id}>
              <a href={`#word/${word.id}`} lang="ja">
                {vocabularyLabel(word)}
              </a>
              <span>{vocabularyMeaning(word)}</span>
              <WordAudioButton word={word} />
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
