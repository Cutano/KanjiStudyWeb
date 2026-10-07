import type { Vocabulary } from "../domain/types";
import { dictionaryTagLabel, parseVocabularySenses } from "../data/text";

/** The template groups senses; a bar in the gloss table alone is not a sense boundary. */
export function VocabularyMeanings({
  word,
  compact = false,
}: {
  word: Vocabulary;
  compact?: boolean;
}) {
  const senses = parseVocabularySenses(word);
  return (
    <ol
      className={`vocabulary-senses ${compact ? "compact-senses" : ""} ${senses.length === 1 ? "single-sense" : ""}`}
      aria-label="Word meanings"
      role="list"
    >
      {senses.map((sense, index) => (
        <li className="vocabulary-sense" value={sense.number} key={index}>
          {sense.partsOfSpeech.length > 0 &&
            sense.partsOfSpeech.join(",") !==
              senses[index - 1]?.partsOfSpeech.join(",") && (
              <div className="sense-labels">
                {sense.partsOfSpeech.map(dictionaryTagLabel).join(" · ")}
              </div>
            )}
          <div className="sense-gloss">
            {senses.length > 1 && (
              <span className="sense-number" aria-hidden="true">
                {sense.number}.
              </span>
            )}
            <span className="sense-gloss-body">
              {sense.content.map((part, partIndex) => (
                <span
                  key={partIndex}
                  className={
                    part.kind === "reference"
                      ? "sense-reference"
                      : part.kind === "note" || part.kind === "tag"
                        ? "sense-qualifier"
                        : undefined
                  }
                >
                  {part.kind === "tag"
                    ? `(${dictionaryTagLabel(part.text)})`
                    : part.text}
                </span>
              ))}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
