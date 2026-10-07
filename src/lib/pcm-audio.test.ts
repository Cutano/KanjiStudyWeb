import { describe, expect, it } from "vitest";
import { pcmToWave } from "./pcm-audio";

describe("PCM speech playback container", () => {
  it("wraps signed 16-bit samples as 24 kHz mono WAV without changing their bytes", async () => {
    const samples = new Uint8Array([0, 128, 0, 0, 255, 127]);
    const wave = pcmToWave(new Blob([samples]), "audio/pcm");
    const data = await wave.arrayBuffer();
    const view = new DataView(data);
    const text = (offset: number, count: number) =>
      new TextDecoder().decode(data.slice(offset, offset + count));
    expect(wave.type).toBe("audio/wav");
    expect(wave.size).toBe(50);
    expect(text(0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(42);
    expect(text(8, 8)).toBe("WAVEfmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint32(28, true)).toBe(48_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(6);
    expect(new Uint8Array(data, 44)).toEqual(samples);
  });

  it("honors provider rate and channel metadata", async () => {
    const wave = pcmToWave(
      new Blob([new Uint8Array(8)]),
      'audio/pcm; Rate="48000"; channels=2',
    );
    const view = new DataView(await wave.arrayBuffer());
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(192_000);
    expect(view.getUint16(32, true)).toBe(4);
  });

  it.each([
    "audio/pcm;rate=0",
    "audio/pcm;rate=NaN",
    "audio/pcm;rate=24000hz",
    "audio/pcm;channels=3",
  ])(
    "rejects unsupported metadata rather than playing at the wrong speed: %s",
    (type) => {
      expect(() => pcmToWave(new Blob([new Uint8Array(4)]), type)).toThrow(
        "unsupported PCM",
      );
    },
  );

  it.each([0, 1, 3])("rejects incomplete mono samples (%i bytes)", (size) => {
    expect(() =>
      pcmToWave(new Blob([new Uint8Array(size)]), "audio/pcm"),
    ).toThrow("incomplete");
  });
  it("rejects a partial stereo frame", () => {
    expect(() =>
      pcmToWave(new Blob([new Uint8Array(6)]), "audio/pcm;channels=2"),
    ).toThrow("incomplete");
  });
});
