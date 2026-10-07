import type { SentenceDetail } from "../domain/types";
import { parseSentence, type RubySegment } from "../data/text";

interface SegmentGroup {
  wordId?: number;
  start?: number;
  parts: RubySegment[];
}

/** Keep ruby intact and link only spans that the catalog actually identifies. */
function groupSentence(sentence: SentenceDetail): SegmentGroup[] {
  const spans = sentence.vocabulary
    .filter((item) => item.length > 0)
    .sort((a, b) => a.start - b.start || b.length - a.length)
    .filter(
      (item, index, ordered) =>
        !ordered
          .slice(0, index)
          .some(
            (previous) =>
              previous.start <= item.start &&
              previous.start + previous.length > item.start,
          ),
    );
  const groups: SegmentGroup[] = [];
  function append(part: RubySegment, start: number, length: number) {
    const span = spans.find(
      (item) =>
        item.start <= start && item.start + item.length >= start + length,
    );
    const previous = groups[groups.length - 1];
    if (
      previous &&
      previous.wordId === span?.word.id &&
      previous.start === span?.start
    )
      previous.parts.push(part);
    else
      groups.push({ wordId: span?.word.id, start: span?.start, parts: [part] });
  }
  let position = 0;
  for (const part of parseSentence(sentence.text)) {
    const characters = [...part.text];
    if (part.reading) append(part, position, characters.length);
    else {
      const boundaries = [
        ...new Set([
          0,
          characters.length,
          ...spans.flatMap((span) => [
            span.start - position,
            span.start + span.length - position,
          ]),
        ]),
      ]
        .filter((value) => value >= 0 && value <= characters.length)
        .sort((a, b) => a - b);
      for (let index = 1; index < boundaries.length; index++) {
        const start = boundaries[index - 1],
          end = boundaries[index];
        if (end > start)
          append(
            { text: characters.slice(start, end).join("") },
            position + start,
            end - start,
          );
      }
    }
    position += characters.length;
  }
  return groups;
}

export function SentenceText({
  sentence,
  furigana,
  divideWords,
}: {
  sentence: SentenceDetail;
  furigana: boolean;
  divideWords: boolean;
}) {
  return (
    <span
      lang="ja"
      className={
        divideWords ? "linked-sentence divided-words" : "linked-sentence"
      }
    >
      {groupSentence(sentence).map((group, index) => {
        const content = group.parts.map((part, partIndex) =>
          part.reading && furigana ? (
            <ruby key={partIndex}>
              {part.text}
              <rt>{part.reading}</rt>
            </ruby>
          ) : (
            <span key={partIndex}>{part.text}</span>
          ),
        );
        return group.wordId === undefined ? (
          <span key={index}>{content}</span>
        ) : (
          <a
            href={`#word/${group.wordId}`}
            key={index}
            className="sentence-word"
          >
            {content}
          </a>
        );
      })}
    </span>
  );
}
