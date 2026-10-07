import { pitchMorae } from "../data/text";

export function PitchDiagram({
  reading,
  accent,
}: {
  reading: string;
  accent: number;
}) {
  const pattern = pitchMorae(reading, accent);
  if (!pattern) return null;
  const positions = pattern.morae.map((mora, index) => ({
    ...mora,
    x: 20 + index * 40,
    y: mora.high ? 16 : 34,
  }));
  const particle = {
    x: positions[positions.length - 1].x + 30,
    y: pattern.particleHigh ? 16 : 34,
  };
  const width = particle.x + 20;
  const levels = pattern.morae
    .map((mora) => `${mora.text}: ${mora.high ? "high" : "low"}`)
    .join(", ");
  const shape =
    accent === 0
      ? "Heiban · no drop"
      : accent === 1
        ? "Atamadaka · initial drop"
        : accent === pattern.morae.length
          ? "Odaka · final drop"
          : "Nakadaka · medial drop";
  return (
    <figure className="pitch-pattern">
      <div className="pitch-scroll">
        <svg
          className="pitch-diagram"
          width={width}
          height={76}
          viewBox={`0 0 ${width} 76`}
          role="img"
          aria-label={`${reading}, pitch accent ${accent}. ${levels}. Following particle: ${pattern.particleHigh ? "high" : "low"}.`}
        >
          <polyline
            points={[...positions, particle]
              .map(({ x, y }) => `${x},${y}`)
              .join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          {positions.map((mora, index) => (
            <g key={index}>
              <circle
                cx={mora.x}
                cy={mora.y}
                r="4"
                fill="currentColor"
                data-mora={mora.text}
                data-pitch={mora.high ? "high" : "low"}
              />
              <text x={mora.x} y="65" textAnchor="middle" lang="ja">
                {mora.text}
              </text>
            </g>
          ))}
          <circle
            cx={particle.x}
            cy={particle.y}
            r="4"
            className="pitch-particle"
            stroke="currentColor"
            strokeWidth="1.8"
            data-pitch={pattern.particleHigh ? "high" : "low"}
          />
        </svg>
      </div>
      <figcaption>
        <span className="pitch-accent-number">{accent}</span>
        {shape}
      </figcaption>
    </figure>
  );
}
