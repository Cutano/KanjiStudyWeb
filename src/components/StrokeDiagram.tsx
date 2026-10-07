import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

interface Props {
  paths: string[];
  glyph?: string;
  speed?: number;
  size?: number;
  compact?: boolean;
}

export function StrokeDiagram({
  paths,
  glyph = "",
  speed = 1,
  size = 280,
  compact = false,
}: Props) {
  const [step, setStep] = useState(paths.length);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  const revealDuration = 750 / speed;
  useEffect(() => {
    setStep(paths.length);
    setPlaying(false);
  }, [paths]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (step < paths.length) setStep(step + 1);
      else setPlaying(false);
    }, 850 / speed);
    return () => clearTimeout(timer);
  }, [playing, step, paths.length, speed]);
  return (
    <div className={`stroke-diagram ${compact ? "compact" : ""}`}>
      <svg
        viewBox="0 0 109 109"
        role="img"
        aria-label={`${glyph} stroke order, ${step} of ${paths.length} strokes`}
        style={{ width: size, maxWidth: "100%" }}
      >
        <path
          d="M54.5 4V105M4 54.5H105"
          stroke="currentColor"
          opacity=".1"
          strokeDasharray="2 3"
        />
        {paths.length === 0 ? (
          <text
            x="54.5"
            y="79"
            textAnchor="middle"
            fontSize="78"
            fill="currentColor"
          >
            {glyph}
          </text>
        ) : (
          paths.map((path, index) => (
            <g
              key={`${replay}-${index}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {playing && index === step - 1 && (
                <path
                  d={path}
                  opacity="0"
                  style={{
                    animation: `stroke-guide-clear ${revealDuration}ms step-end both`,
                  }}
                />
              )}
              <path
                d={path}
                pathLength="1"
                opacity={index < step ? 1 : 0.07}
                style={
                  playing && index === step - 1
                    ? {
                        strokeDasharray: 1,
                        animation: `stroke-reveal ${revealDuration}ms linear both`,
                      }
                    : undefined
                }
              />
            </g>
          ))
        )}
      </svg>
      {paths.length > 0 ? (
        <div className="stroke-controls">
          <button
            type="button"
            aria-label="Previous stroke"
            disabled={step === 0}
            onClick={() => {
              setPlaying(false);
              setStep(Math.max(0, step - 1));
            }}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            aria-label={
              playing ? "Pause stroke animation" : "Play stroke animation"
            }
            onClick={() => {
              if (!playing && step >= paths.length) {
                setStep(1);
                setReplay(replay + 1);
              }
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            type="button"
            aria-label="Replay stroke animation"
            onClick={() => {
              setStep(1);
              setReplay(replay + 1);
              setPlaying(true);
            }}
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            aria-label="Next stroke"
            disabled={step === paths.length}
            onClick={() => {
              setPlaying(false);
              setStep(Math.min(paths.length, step + 1));
            }}
          >
            <ChevronRight size={17} />
          </button>
          <span>
            {step} / {paths.length}
          </span>
        </div>
      ) : (
        <p className="muted">
          Stroke paths are unavailable for this character.
        </p>
      )}
    </div>
  );
}
