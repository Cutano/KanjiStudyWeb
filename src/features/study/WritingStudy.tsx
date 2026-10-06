import type { CharacterDetail, StudyConfig } from "../../domain/types";
import { cleanReading } from "../../data/text";
import { StrokeDiagram } from "../../components/StrokeDiagram";
import { WritingCanvas } from "../../components/WritingCanvas";
interface Props {
  character: CharacterDetail;
  writingMode: StudyConfig["writingMode"];
  strokeSpeed: number;
  strictness?: StudyConfig["writingStrictness"];
  showHints?: boolean;
  identity: string;
  saving: boolean;
  answer: (correct: boolean) => Promise<void>;
}
export function WritingStudy({
  character,
  writingMode,
  strokeSpeed,
  strictness,
  showHints,
  identity,
  saving,
  answer,
}: Props) {
  return (
    <div className="writing-layout">
      <div className="writing-prompt">
        <p className="study-eyebrow">
          {writingMode === "guided"
            ? "FOLLOW THE STROKES"
            : "WRITE FROM MEMORY"}
        </p>
        <h2>{character.meaning || character.reading || character.glyph}</h2>
        <p lang="ja" className="muted">
          {cleanReading(
            [
              character.onReading,
              character.kunReading,
              character.reading && !character.onReading && !character.kunReading
                ? character.reading
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
          )}
        </p>
      </div>
      <WritingCanvas
        key={identity}
        paths={character.paths}
        glyph={character.glyph}
        mode={writingMode}
        strictness={strictness}
        showHints={showHints}
        disabled={saving}
        onComplete={({ correct }) => {
          void answer(correct);
        }}
      />
      <details className="study-writing-reference">
        <summary>View stroke animation</summary>
        <StrokeDiagram
          paths={character.paths}
          glyph={character.glyph}
          speed={strokeSpeed}
        />
      </details>
    </div>
  );
}
