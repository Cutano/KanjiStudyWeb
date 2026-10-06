import { describe, expect, it } from "vitest";
import { matchStroke, polylineLength, resample } from "./handwriting";

const horizontal = [
  { x: 10, y: 52 },
  { x: 50, y: 50 },
  { x: 95, y: 48 },
];

describe("ordered handwriting geometry", () => {
  it("accepts natural displacement and irregular pointer sampling", () => {
    const input = [
      { x: 12, y: 55 },
      { x: 13, y: 55 },
      { x: 38, y: 52 },
      { x: 88, y: 49 },
      { x: 96, y: 48 },
    ];
    expect(matchStroke(input, horizontal).accepted).toBe(true);
  });
  it("rejects a stroke drawn in the wrong direction", () => {
    expect(matchStroke([...horizontal].reverse(), horizontal).reason).toBe(
      "start",
    );
  });
  it("rejects a different shape even when endpoints coincide", () => {
    const loop = [
      { x: 10, y: 52 },
      { x: 33, y: 90 },
      { x: 65, y: 92 },
      { x: 95, y: 48 },
    ];
    expect(matchStroke(loop, horizontal).accepted).toBe(false);
  });
  it("rejects incomplete strokes and isolated taps", () => {
    expect(matchStroke([{ x: 10, y: 52 }], horizontal).accepted).toBe(false);
    expect(
      matchStroke(
        [
          { x: 10, y: 52 },
          { x: 20, y: 52 },
        ],
        horizontal,
      ).accepted,
    ).toBe(false);
  });
  it("keeps path endpoints when resampling and handles stationary events", () => {
    const points = resample(horizontal, 8);
    expect(points).toHaveLength(8);
    expect(points[0]).toEqual(horizontal[0]);
    expect(points[7]).toEqual(horizontal[2]);
    expect(
      resample(
        [
          { x: 2, y: 3 },
          { x: 2, y: 3 },
        ],
        8,
      ),
    ).toHaveLength(8);
    expect(polylineLength(horizontal)).toBeGreaterThan(85);
  });
  it("applies explicit recognition strictness without changing direction checks", () => {
    const displaced = horizontal.map((point) => ({
      x: point.x,
      y: point.y + 11,
    }));
    expect(matchStroke(displaced, horizontal, "relaxed").accepted).toBe(true);
    expect(matchStroke(displaced, horizontal, "strict").accepted).toBe(false);
    expect(
      matchStroke([...horizontal].reverse(), horizontal, "relaxed").accepted,
    ).toBe(false);
  });
  it("accepts a curved stroke in its own position without normalizing away placement", () => {
    const curve = [
      { x: 70, y: 20 },
      { x: 66, y: 45 },
      { x: 55, y: 68 },
      { x: 30, y: 85 },
    ];
    expect(
      matchStroke(
        curve.map((point) => ({ x: point.x + 3, y: point.y - 2 })),
        curve,
      ).accepted,
    ).toBe(true);
    expect(
      matchStroke(
        curve.map((point) => ({ x: point.x - 35, y: point.y })),
        curve,
      ).accepted,
    ).toBe(false);
  });
});
