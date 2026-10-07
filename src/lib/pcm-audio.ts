export const WAVE_HEADER_BYTES = 44;

/** The speech API's raw PCM contract is signed 16-bit little-endian audio. */
export function pcmToWave(pcm: Blob, contentType: string): Blob {
  const parameters = new Map(
    contentType
      .split(";")
      .slice(1)
      .map((part) => {
        const [name, value = ""] = part.split("=");
        return [
          name.trim().toLowerCase(),
          value.trim().replace(/^"(.*)"$/, "$1"),
        ];
      }),
  );
  const sampleRate = Number(parameters.get("rate") ?? 24_000);
  const channels = Number(parameters.get("channels") ?? 1);
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 8_000 ||
    sampleRate > 192_000
  ) {
    throw new Error("The speech API returned an unsupported PCM sample rate.");
  }
  if (channels !== 1 && channels !== 2) {
    throw new Error(
      "The speech API returned an unsupported PCM channel count.",
    );
  }
  const blockAlign = channels * 2;
  if (!pcm.size || pcm.size % blockAlign !== 0) {
    throw new Error("The speech API returned incomplete 16-bit PCM audio.");
  }
  const header = new ArrayBuffer(WAVE_HEADER_BYTES);
  const view = new DataView(header);
  const label = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  label(0, "RIFF");
  view.setUint32(4, pcm.size + 36, true);
  label(8, "WAVE");
  label(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM.
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  label(36, "data");
  view.setUint32(40, pcm.size, true);
  return new Blob([header, pcm], { type: "audio/wav" });
}
