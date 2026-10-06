export interface Point {
  x: number;
  y: number;
}
export interface StrokeMatch {
  accepted: boolean;
  reason: "accepted" | "too-short" | "start" | "end" | "shape";
  distance: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polylineLength(points: readonly Point[]): number {
  return points
    .slice(1)
    .reduce((sum, point, index) => sum + distance(points[index], point), 0);
}

/** Arc-length sampling makes the score independent of device event frequency. */
export function resample(points: readonly Point[], count = 24): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1)
    return Array.from({ length: count }, () => ({ ...points[0] }));
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1)
    lengths.push(
      lengths[index - 1] + distance(points[index - 1], points[index]),
    );
  const total = lengths[lengths.length - 1];
  if (total === 0)
    return Array.from({ length: count }, () => ({ ...points[0] }));
  let segment = 1;
  return Array.from({ length: count }, (_, index) => {
    const target = (total * index) / (count - 1);
    while (segment < lengths.length - 1 && lengths[segment] < target)
      segment += 1;
    const span = lengths[segment] - lengths[segment - 1];
    const fraction = span ? (target - lengths[segment - 1]) / span : 0;
    return {
      x:
        points[segment - 1].x +
        (points[segment].x - points[segment - 1].x) * fraction,
      y:
        points[segment - 1].y +
        (points[segment].y - points[segment - 1].y) * fraction,
    };
  });
}

/** Coordinates use the catalog's 109 × 109 KanjiVG viewport.
 * Direction and endpoint checks preserve stroke order. Mean arc-length distance
 * then tolerates ordinary handwriting variation without accepting arbitrary lines.
 */
export function matchStroke(
  actual: readonly Point[],
  expected: readonly Point[],
  strictness: "relaxed" | "normal" | "strict" = "normal",
): StrokeMatch {
  const tolerance = { relaxed: 1.35, normal: 1, strict: 0.7 }[strictness];
  if (actual.length < 2 || expected.length < 2)
    return { accepted: false, reason: "too-short", distance: Infinity };
  const actualLength = polylineLength(actual);
  const expectedLength = polylineLength(expected);
  if (
    actualLength < Math.max(2, expectedLength * 0.42) ||
    actualLength > expectedLength * 2.2 + 8
  ) {
    return { accepted: false, reason: "too-short", distance: Infinity };
  }
  if (distance(actual[0], expected[0]) > 15 * tolerance)
    return { accepted: false, reason: "start", distance: Infinity };
  if (
    distance(actual[actual.length - 1], expected[expected.length - 1]) >
    17 * tolerance
  )
    return { accepted: false, reason: "end", distance: Infinity };
  const input = resample(actual);
  const target = resample(expected);
  const mean =
    input.reduce(
      (sum, point, index) => sum + distance(point, target[index]),
      0,
    ) / input.length;
  return {
    accepted: mean <= 12 * tolerance,
    reason: mean <= 12 * tolerance ? "accepted" : "shape",
    distance: mean,
  };
}

export function pointsToPath(points: readonly Point[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
    )
    .join(" ");
}
