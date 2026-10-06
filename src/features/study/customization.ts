import type { CharacterSummary, UserProfile } from "../../domain/types";

/** Empty editor fields mean “use the catalog”; notes never erase reference text. */
export function applyStudyOverrides<T extends CharacterSummary>(
  character: T,
  overrides: UserProfile["overrides"],
): T {
  const custom = overrides[character.key];
  if (!custom) return character;
  return {
    ...character,
    meaning: custom.meaning || character.meaning,
    onReading: custom.onReading || character.onReading,
    kunReading: custom.kunReading || character.kunReading,
    reading: custom.reading || character.reading,
  };
}
