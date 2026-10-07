import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  CharacterDetail,
  Rating,
  UserProfile,
  Vocabulary,
} from "../../domain/types";
import {
  cleanReading,
  vocabularyLabel,
  vocabularyMeaning,
} from "../../data/text";
import { WordAudioButton, FavoriteButton } from "../../components/common";
import { StrokeDiagram } from "../../components/StrokeDiagram";
interface Props {
  character: CharacterDetail;
  words: Vocabulary[];
  profile: UserProfile;
  revealed: boolean;
  setRevealed: (value: boolean) => void;
  saving: boolean;
  preview: number | null;
  setPreview: (value: number | null) => void;
  index: number;
  currentIndex: number;
  answer: (correct: boolean, rating?: Rating) => Promise<void>;
}
export function FlashcardStudy({
  character,
  words,
  profile,
  revealed,
  setRevealed,
  saving,
  preview,
  setPreview,
  index,
  currentIndex,
  answer,
}: Props) {
  return (
    <div className="flashcard-layout">
      <div className="flashcard" onClick={() => setRevealed(true)}>
        <div className="flashcard-top">
          <span>
            {character.kind.toUpperCase()} · {character.strokeCount} STROKES
          </span>
          <FavoriteButton id={character.key} />
        </div>
        <div className="flashcard-glyph" lang="ja">
          {character.glyph}
        </div>
        {revealed ? (
          <div className="flashcard-answer">
            <h2>{character.meaning || character.reading}</h2>
            <div className="study-readings">
              {character.onReading && (
                <p>
                  <span>ON</span>
                  <strong lang="ja">{cleanReading(character.onReading)}</strong>
                </p>
              )}
              {character.kunReading && (
                <p>
                  <span>KUN</span>
                  <strong lang="ja">
                    {cleanReading(character.kunReading)}
                  </strong>
                </p>
              )}
              {!character.onReading && !character.kunReading && (
                <p>
                  <strong lang="ja">{character.reading}</strong>
                </p>
              )}
            </div>
            {profile.notes[character.key] && (
              <p className="study-note">{profile.notes[character.key]}</p>
            )}
            {words.slice(0, 2).map((word) => (
              <div className="study-word" key={word.id}>
                <a href={`#word/${word.id}`} lang="ja">
                  {vocabularyLabel(word)}
                </a>
                <span>{vocabularyMeaning(word).slice(0, 100)}</span>
                <WordAudioButton word={word} />
              </div>
            ))}
            <details className="study-stroke-details">
              <summary>Explore the stroke order</summary>
              <StrokeDiagram
                paths={character.paths}
                glyph={character.glyph}
                speed={profile.settings.strokeSpeed}
                size={210}
              />
            </details>
          </div>
        ) : (
          <button
            type="button"
            className="study-reveal"
            onClick={() => setRevealed(true)}
          >
            Reveal meaning & readings <span>or press space</span>
          </button>
        )}
        <div className="flashcard-bottom">
          <span>
            {
              ["New", "Seen", "Familiar", "Known"][
                profile.progress[character.key]?.rating || 0
              ]
            }
          </span>
          <a href={`#character/${character.key}`}>Character details ↗</a>
        </div>
      </div>
      {revealed && preview === null && (
        <div className="study-rating-bar">
          <p>How well did you recall it?</p>
          <div>
            {(
              [
                { grade: 0, title: "Again", detail: "Still learning" },
                { grade: 1, title: "Hard", detail: "A little unsure" },
                { grade: 2, title: "Good", detail: "Remembered it" },
                { grade: 3, title: "Easy", detail: "Knew it well" },
              ] as const
            ).map(({ grade, title, detail }) => (
              <button
                key={grade}
                className={`study-grade-${grade}`}
                disabled={saving}
                onClick={() => answer(grade >= 2, grade)}
              >
                <strong>{title}</strong>
                <span>{detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="study-card-nav">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => {
            setPreview(index - 1);
            setRevealed(false);
          }}
        >
          <ChevronLeft size={18} /> Previous
        </button>
        <span>
          {preview !== null ? `Card ${preview + 1}` : "Rate a card to continue"}
        </span>
        <button
          type="button"
          disabled={preview === null}
          onClick={() =>
            setPreview(index + 1 < currentIndex ? index + 1 : null)
          }
        >
          Next <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
