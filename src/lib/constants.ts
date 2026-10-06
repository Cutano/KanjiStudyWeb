import type { SequenceSystem } from "../domain/types";
export const SYSTEMS: { value: SequenceSystem; label: string }[] = [
  { value: "jouyou", label: "Japanese school grades" },
  { value: "jouyou_revised", label: "School grades · revised" },
  { value: "jlpt", label: "JLPT levels" },
  { value: "jlpt_revised", label: "JLPT · revised" },
  { value: "heisig", label: "Remembering the Kanji" },
  { value: "heisig_revised", label: "Remembering the Kanji · revised" },
  { value: "kanken", label: "Kanji Kentei" },
  { value: "kanken_revised", label: "Kanji Kentei · revised" },
  { value: "kklc", label: "Kanji Learner’s Course" },
  { value: "freq", label: "Frequency" },
  { value: "hadamitzky", label: "Hadamitzky & Spahn" },
  { value: "kic", label: "Kanji in Context" },
];
export function levelLabel(system: SequenceSystem, level: number): string {
  if (level === 0) return "Unclassified";
  if (system.startsWith("jlpt")) return `JLPT N${level}`;
  if (system.startsWith("jouyou"))
    return level <= 6
      ? `Grade ${level}`
      : ["Secondary school", "Jinmeiyō", "Advanced", "Other"][level - 7] ||
          `Group ${level}`;
  return `Group ${level}`;
}
export const RATING_LABELS = ["New", "Learning", "Familiar", "Known"];

export const SYSTEM_LEVELS: Record<SequenceSystem, number> = {
  jouyou: 10,
  jouyou_revised: 10,
  jlpt: 5,
  jlpt_revised: 5,
  heisig: 56,
  heisig_revised: 56,
  kanken: 12,
  kanken_revised: 12,
  kklc: 23,
  freq: 20,
  hadamitzky: 43,
  kic: 7,
};
