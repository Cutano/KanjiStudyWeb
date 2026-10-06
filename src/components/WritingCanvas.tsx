import { useRef, useState, type PointerEvent } from "react";
import { Eye, RotateCcw, Undo2 } from "lucide-react";
import {
  matchStroke,
  pointsToPath,
  type Point,
} from "../features/study/handwriting";

interface Props {
  paths: string[];
  glyph: string;
  mode: "guided" | "test" | "manual" | "self";
  strictness?: "relaxed" | "normal" | "strict";
  showHints?: boolean;
  disabled?: boolean;
  onComplete: (result: { correct: boolean; mistakes: number }) => void;
}
const reasonText = {
  "too-short": "Follow the full length of the next stroke.",
  start: "Start near the beginning of the next stroke.",
  end: "Finish at the end of the next stroke.",
  shape: "Follow the shape of the next stroke.",
  accepted: "Good stroke.",
};

export function WritingCanvas({
  paths,
  glyph,
  mode,
  strictness = "normal",
  showHints = true,
  disabled = false,
  onComplete,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const samples = useRef<(SVGPathElement | null)[]>([]);
  const pointer = useRef<number | null>(null);
  const [drawing, setDrawing] = useState<Point[]>([]);
  const [pendingStroke, setPendingStroke] = useState<Point[]>([]);
  const current = useRef<Point[]>([]);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState("Write each stroke in order.");
  const selfCheck = mode === "self" || paths.length === 0;
  const complete = !selfCheck && strokes.length === paths.length;

  function point(event: PointerEvent<SVGSVGElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) * 109) / box.width,
      y: ((event.clientY - box.top) * 109) / box.height,
    };
  }
  function start(event: PointerEvent<SVGSVGElement>) {
    if (
      complete ||
      disabled ||
      pendingStroke.length ||
      pointer.current !== null
    )
      return;
    event.preventDefault();
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    current.current = [point(event)];
    setDrawing(current.current);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (pointer.current !== event.pointerId) return;
    current.current = [...current.current, point(event)];
    setDrawing(current.current);
  }
  function finish(event: PointerEvent<SVGSVGElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    const stroke = [...current.current, point(event)];
    current.current = [];
    setDrawing([]);
    if (selfCheck) {
      setStrokes([...strokes, stroke]);
      setFeedback("Compare your writing with the reference, then rate it.");
      return;
    }
    if (mode === "manual") {
      setPendingStroke(stroke);
      setFeedback("Press Check stroke to evaluate this stroke.");
      return;
    }
    evaluateStroke(stroke);
  }
  function evaluateStroke(stroke: Point[]) {
    setPendingStroke([]);
    const path = samples.current[strokes.length];
    if (!path) return;
    const length = path.getTotalLength();
    const expected = Array.from({ length: 32 }, (_, index) => {
      const p = path.getPointAtLength((length * index) / 31);
      return { x: p.x, y: p.y };
    });
    const match = matchStroke(stroke, expected, strictness);
    if (match.accepted) {
      setStrokes([...strokes, stroke]);
      setFeedback(
        strokes.length + 1 === paths.length
          ? "Character complete. Well done."
          : `Stroke ${strokes.length + 1} accepted. Continue with stroke ${strokes.length + 2}.`,
      );
      setHint(false);
    } else {
      setMistakes(mistakes + 1);
      setFeedback(reasonText[match.reason]);
      setHint(showHints);
    }
  }
  function reset() {
    setStrokes([]);
    setPendingStroke([]);
    setDrawing([]);
    current.current = [];
    pointer.current = null;
    setHint(false);
    setFeedback("Try the character again.");
  }
  function rate(correct: boolean) {
    onComplete({ correct, mistakes });
  }

  return (
    <div className="writing-practice">
      <div className="writing-status">
        <span>
          {selfCheck
            ? "Self-check"
            : `${strokes.length} / ${paths.length} strokes`}
        </span>
        <span>
          {mistakes} {mistakes === 1 ? "retry" : "retries"}
        </span>
      </div>
      <svg
        ref={svg}
        viewBox="0 0 109 109"
        className="writing-canvas"
        role="img"
        aria-label={`Writing area for ${glyph}. ${selfCheck ? "Draw and self-assess." : "Draw strokes in order."}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          pointer.current = null;
          current.current = [];
          setDrawing([]);
        }}
      >
        <path
          d="M54.5 0V109M0 54.5H109M0 0L109 109M109 0L0 109"
          className="writing-grid"
        />
        {paths.map((path, index) => (
          <path
            ref={(node) => {
              samples.current[index] = node;
            }}
            key={index}
            d={path}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
              index < strokes.length && !selfCheck
                ? "stroke-accepted"
                : "stroke-guide"
            }
            opacity={
              index < strokes.length && !selfCheck
                ? 1
                : mode === "guided" || hint
                  ? index === strokes.length
                    ? 0.4
                    : 0.12
                  : 0
            }
          />
        ))}
        {paths.length === 0 && hint && (
          <text x="54.5" y="80" textAnchor="middle" fontSize="80" opacity=".12">
            {glyph}
          </text>
        )}
        {(selfCheck ? strokes : []).map((stroke, index) => (
          <path key={index} d={pointsToPath(stroke)} className="stroke-input" />
        ))}
        {pendingStroke.length > 0 && (
          <path d={pointsToPath(pendingStroke)} className="stroke-input" />
        )}
        {drawing.length > 0 && (
          <path d={pointsToPath(drawing)} className="stroke-input" />
        )}
      </svg>
      <p role="status" className="writing-feedback">
        {feedback}
      </p>
      {pendingStroke.length > 0 && (
        <button
          type="button"
          className="study-primary study-wide"
          onClick={() => evaluateStroke(pendingStroke)}
        >
          Check stroke
        </button>
      )}
      <div className="writing-tools">
        <button
          type="button"
          onClick={() => {
            setHint(!hint);
            if (!hint) setMistakes(mistakes + 1);
          }}
          disabled={disabled}
        >
          <Eye size={17} /> {hint ? "Hide reference" : "Hint"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (pendingStroke.length) setPendingStroke([]);
            else setStrokes(strokes.slice(0, -1));
            setFeedback("Previous stroke removed.");
          }}
          disabled={
            (strokes.length === 0 && pendingStroke.length === 0) || disabled
          }
        >
          <Undo2 size={17} /> Undo
        </button>
        <button type="button" onClick={reset} disabled={disabled}>
          <RotateCcw size={17} /> Clear
        </button>
      </div>
      {paths.length === 0 && (
        <p className="muted">
          This catalog has no stroke paths for {glyph}. Use the reference and
          assess your writing yourself.
        </p>
      )}
      {selfCheck && strokes.length > 0 && (
        <div className="study-rating-pair">
          <button type="button" onClick={() => rate(false)} disabled={disabled}>
            Needs practice
          </button>
          <button
            type="button"
            className="study-primary"
            onClick={() => rate(true)}
            disabled={disabled}
          >
            I wrote it correctly
          </button>
        </div>
      )}
      {complete && (
        <button
          type="button"
          className="study-primary study-wide"
          disabled={disabled}
          onClick={() => rate(mistakes === 0)}
        >
          Continue
        </button>
      )}
      {!selfCheck && !complete && (
        <button
          type="button"
          className="study-link"
          disabled={disabled}
          onClick={() => rate(false)}
        >
          Skip and review later
        </button>
      )}
    </div>
  );
}
