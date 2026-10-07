export interface PitchPattern {
  accent: number;
  morae: { text: string; high: boolean }[];
  particleHigh: boolean;
}

/** Tokyo lexical pitch, including a following unaccented particle to distinguish 0 from final accent. */
export function pitchMorae(
  reading: string,
  accent: number,
): PitchPattern | null {
  const normalized = reading.normalize("NFC");
  if (
    !Number.isInteger(accent) ||
    accent < 0 ||
    !/^[ぁ-ゖァ-ヶー]+$/.test(normalized)
  )
    return null;
  const morae: string[] = [];
  for (const character of normalized) {
    if (
      /[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/.test(character) &&
      morae.length
    )
      morae[morae.length - 1] += character;
    else morae.push(character);
  }
  if (accent > morae.length) return null;
  return {
    accent,
    morae: morae.map((text, index) => ({
      text,
      high:
        accent === 1
          ? index === 0
          : index > 0 && (accent === 0 || index < accent),
    })),
    particleHigh: accent === 0,
  };
}
