import { describe, expect, it } from "vitest";
import type { CharacterDetail, Sentence } from "../../domain/types";
import { makeQuestion } from "./quiz";
import { applyStudyOverrides } from "./customization";

const character: CharacterDetail = {
  key: "kanji:23398",
  kind: "kanji",
  code: 23398,
  glyph: "学",
  meaning: "study",
  onReading: "ガク",
  kunReading: "まな.ぶ",
  reading: "gaku",
  strokeCount: 8,
  level: 1,
  sequence: 1,
  paths: [],
  components: [],
  decomposition: "",
  classicalRadical: "",
  nanori: "",
  pinyin: "",
  korean: "",
  koreanRomanized: "",
  vietnamese: "",
  variants: "",
  variantOf: "",
  kangxiNumber: null,
  kangxiBase: "",
  radicalPosition: null,
  isImportant: false,
  isArchaic: false,
  isDiacritic: false,
  origin: "",
  example: "",
  isKokuji: false,
  isPhantom: false,
  sequences: {},
};
const others = ["校", "生", "先"].map((glyph, index) => ({
  ...character,
  key: `kanji:${glyph.codePointAt(0)!}` as const,
  glyph,
  meaning: ["school", "life", "before"][index],
}));

describe("quiz question generation", () => {
  it("pairs kana scripts while keeping voiced character identity", () => {
    const kana = {
      ...character,
      key: "hiragana:12364" as const,
      kind: "hiragana" as const,
      code: 12364,
      glyph: "が",
      reading: "ga",
    };
    const question = makeQuestion(kana, [], "kana-pair", [], []);
    expect(question.prompt).toBe("が");
    expect(question.answer).toBe("ガ");
    expect(question.hint).toContain("katakana");
  });
  it("keeps catalog fields when a note-only edit stores empty overrides", () => {
    const result = applyStudyOverrides(character, {
      [character.key]: { meaning: "", onReading: "", kunReading: "" },
    });
    expect(result.meaning).toBe("study");
    expect(result.onReading).toBe("ガク");
    expect(result.kunReading).toBe("まな.ぶ");
    expect(result.reading).toBe("gaku");
    expect(
      applyStudyOverrides(character, {
        [character.key]: { meaning: "my mnemonic" },
      }).meaning,
    ).toBe("my mnemonic");
  });
  it("uses a generic kana or radical reading override in study questions", () => {
    const kana = {
      ...character,
      key: "hiragana:12364" as const,
      kind: "hiragana" as const,
      glyph: "が",
      onReading: "",
      kunReading: "",
      reading: "ga",
    };
    const edited = applyStudyOverrides(kana, {
      [kana.key]: { reading: "custom reading" },
    });
    expect(makeQuestion(edited, [], "kana", [], []).answer).toBe(
      "custom reading",
    );
    expect(
      applyStudyOverrides(kana, { [kana.key]: { reading: "" } }).reading,
    ).toBe("ga");
  });
  it("offers exactly one target among distinct distractors", () => {
    const question = makeQuestion(
      character,
      [character, ...others, others[0]],
      "meaning",
      [],
      [],
      () => 0.3,
    );
    expect(question.choices).toHaveLength(4);
    expect(new Set(question.choices.map((item) => item.label)).size).toBe(4);
    expect(
      question.choices.filter((item) => item.key === character.key),
    ).toHaveLength(1);
  });
  it("removes the target character from sentence prompts while retaining the other text", () => {
    const sentences: Sentence[] = [
      { id: 1, text: "{2がっこう}学校へ行く。", translation: "Go to school." },
    ];
    const question = makeQuestion(character, others, "sentence", [], sentences);
    expect(question.prompt).toBe("□校へ行く。");
    expect(question.fallback).toBe(false);
    expect(question.hint).toBe("Go to school.");
  });
  it("falls back transparently for characters without linked context", () => {
    const question = makeQuestion(character, others, "word", [], []);
    expect(question.prompt).toBe("study");
    expect(question.fallback).toBe(true);
    expect(question.hint).toContain("No linked context");
  });
  it("does not create duplicate meaning answers", () => {
    const question = makeQuestion(
      character,
      [...others, { ...others[0], meaning: "study" }],
      "character",
      [],
      [],
    );
    expect(
      question.choices.filter((choice) => choice.label === "study"),
    ).toHaveLength(1);
  });
});
