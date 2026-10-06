import type {
  CharacterDetail,
  CharacterSummary,
  QuizPrompt,
  Sentence,
  Vocabulary,
} from "../../domain/types";
import {
  cleanReading,
  plainSentence,
  vocabularyLabel,
  vocabularyMeaning,
} from "../../data/text";

export interface Question {
  prompt: string;
  hint: string;
  answer: string;
  choices: { key: string; label: string }[];
  fallback: boolean;
}

export function pairedKana(glyph: string): string {
  const code = glyph.codePointAt(0)!;
  if (code >= 0x3041 && code <= 0x3096)
    return String.fromCodePoint(code + 0x60);
  if (code >= 0x30a1 && code <= 0x30f6)
    return String.fromCodePoint(code - 0x60);
  return glyph;
}

export function answerLabel(item: CharacterSummary, type: QuizPrompt): string {
  if (type === "kana-pair") return pairedKana(item.glyph);
  if (type === "character") return item.meaning || item.glyph;
  if (type === "kana")
    return (
      cleanReading(item.reading || item.onReading || item.kunReading) ||
      item.glyph
    );
  return item.glyph;
}

export function makeQuestion(
  item: CharacterDetail,
  candidates: CharacterSummary[],
  type: QuizPrompt,
  words: Vocabulary[],
  sentences: Sentence[],
  random: () => number = Math.random,
): Question {
  const word = words.find(
    (value) =>
      vocabularyLabel(value).includes(item.glyph) &&
      vocabularyLabel(value) !== item.glyph,
  );
  const sentence = sentences.find((value) =>
    plainSentence(value.text).includes(item.glyph),
  );
  const reading = cleanReading(
    [item.onReading, item.kunReading].filter(Boolean).join(" · ") ||
      item.reading,
  );
  let prompt =
    type === "meaning"
      ? item.meaning
      : type === "reading"
        ? reading
        : item.glyph;
  let hint =
    type === "meaning"
      ? "Which character matches this meaning?"
      : type === "reading"
        ? "Which character has this reading?"
        : type === "character"
          ? "Choose the meaning."
          : "Choose the reading.";
  if (type === "kana-pair")
    hint =
      item.kind === "hiragana"
        ? "Choose the matching katakana."
        : "Choose the matching hiragana.";
  let fallback = false;
  if (type === "word" || type === "sentence") {
    const context =
      type === "word"
        ? word
          ? vocabularyLabel(word)
          : undefined
        : sentence
          ? plainSentence(sentence.text)
          : undefined;
    prompt = context ? context.replaceAll(item.glyph, "□") : item.meaning;
    hint = context
      ? type === "word" && word
        ? `${word.readings.split(";")[0]} · ${vocabularyMeaning(word)}`
        : sentence!.translation
      : "No linked context is available. Choose the character from its meaning.";
    fallback = !context;
  }
  if (!prompt) {
    prompt = `${item.strokeCount} strokes · ${item.glyph}`;
    hint = "This entry has no prompt text. Use the character reference.";
    fallback = true;
  }
  const answer = answerLabel(item, type);
  const options = [{ key: item.key, label: answer }];
  const others = candidates.filter((candidate) => {
    if (candidate.key === item.key || answerLabel(candidate, type) === answer)
      return false;
    if (type === "meaning" && candidate.meaning === item.meaning) return false;
    if (
      type === "reading" &&
      cleanReading(
        [candidate.onReading, candidate.kunReading]
          .filter(Boolean)
          .join(" · ") || candidate.reading,
      ) === reading
    )
      return false;
    return true;
  });
  for (let index = others.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [others[index], others[swap]] = [others[swap], others[index]];
  }
  for (const other of others) {
    const label = answerLabel(other, type);
    if (!options.some((option) => option.label === label))
      options.push({ key: other.key, label });
    if (options.length === 4) break;
  }
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [options[index], options[swap]] = [options[swap], options[index]];
  }
  return { prompt, hint, answer, choices: options, fallback };
}
