/** The catalog's reading markers remain in raw fields; only presentation removes them. */
export function cleanReading(text: string): string {
  return text.replace(/[!*]/g, "").replaceAll(",", "、");
}
export function vocabularyLabel(word: {
  entry: string;
  readings: string;
}): string {
  return (
    word.entry.split("|")[0] || word.readings.split(";")[0].split(",")[0] || ""
  );
}
export function vocabularyMeaning(word: {
  meanings: string;
  meaningsTemplate: string;
}): string {
  const meanings = word.meanings.split("|");
  return word.meaningsTemplate.replace(
    /\[(\d+)\]/g,
    (original, ordinal: string) => meanings[Number(ordinal) - 1] ?? original,
  );
}
export interface RubySegment {
  text: string;
  reading?: string;
}

/** Braced readings precede one glyph, or the explicit number of following glyphs. */
export function parseSentence(source: string): RubySegment[] {
  const characters = Array.from(source);
  const segments: RubySegment[] = [];
  let plain = "";
  const flush = () => {
    if (plain) {
      segments.push({ text: plain });
      plain = "";
    }
  };
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (character === "\u3000") continue;
    if (character !== "{") {
      plain += character;
      continue;
    }
    const end = characters.indexOf("}", index + 1);
    if (end === -1) {
      plain += character;
      continue;
    }
    const annotation = characters.slice(index + 1, end).join("");
    const match = /^(\d+)?(.+)$/.exec(annotation);
    if (!match) {
      plain += characters.slice(index, end + 1).join("");
      index = end;
      continue;
    }
    const length = Number(match[1] || 1);
    const text = characters.slice(end + 1, end + 1 + length).join("");
    flush();
    segments.push({ text, reading: match[2] });
    index = end + length;
  }
  flush();
  return segments;
}
export function plainSentence(source: string): string {
  return parseSentence(source)
    .map((segment) => segment.text)
    .join("");
}

export interface VocabularyForm {
  text: string;
  segments: RubySegment[];
  readings: string[];
  pitchAccents: number[];
  flags: string[];
}
interface FormReading {
  text: string;
  body: string;
  pitchAccents: number[];
  flags: string[];
}
function formReading(template: string): FormReading {
  const [body, ...metadata] = template.split(",");
  return {
    text: body
      .split(" ")
      .map((part) => part.replace(/^\d+/, ""))
      .join(""),
    body,
    pitchAccents: metadata.filter((part) => /^\d+$/.test(part)).map(Number),
    flags: metadata.filter((part) => !/^\d+$/.test(part)),
  };
}
function alignForm(text: string, reading: FormReading): RubySegment[] {
  if (text === reading.text) return [{ text }];
  const characters = Array.from(text);
  const segments: RubySegment[] = [];
  let position = 0;
  for (const token of reading.body.split(" ").filter(Boolean)) {
    const match = /^(\d+)?(.+)$/.exec(token);
    if (!match) return [{ text, reading: reading.text }];
    const annotation = match[2];
    const remaining = characters.slice(position).join("");
    const count = match[1]
      ? Number(match[1])
      : remaining.startsWith(annotation)
        ? Array.from(annotation).length
        : 1;
    const surface = characters.slice(position, position + count).join("");
    if (!surface || position + count > characters.length)
      return [{ text, reading: reading.text }];
    segments.push(
      surface === annotation
        ? { text: surface }
        : { text: surface, reading: annotation },
    );
    position += count;
  }
  // Jukujikun and unsegmented source readings safely annotate the complete form.
  return position === characters.length
    ? segments
    : [{ text, reading: reading.text }];
}

/** Decode source form references and reading segments while preserving lexical metadata. */
export function parseVocabularyForms(word: {
  entry: string;
  entryTemplate: string;
  readings: string;
}): VocabularyForm[] {
  const spellings = word.entry.split("|");
  const forms: VocabularyForm[] = [];
  for (const clause of word.entryTemplate.split(/[|;]/)) {
    const [header, ...variants] = clause.split(":");
    const [reference, ...flags] = header.split(",");
    const ordinal = /^\[(\d+)\]$/.exec(reference);
    const text = ordinal ? spellings[Number(ordinal[1]) - 1] : reference;
    if (!text) continue;
    const readings = variants.length
      ? variants.map(formReading)
      : [formReading(header)];
    const first = readings[0];
    forms.push({
      text,
      segments:
        ordinal && variants.length ? alignForm(text, first) : [{ text }],
      readings: [...new Set(readings.map((reading) => reading.text))],
      pitchAccents: [
        ...new Set(readings.flatMap((reading) => reading.pitchAccents)),
      ],
      flags: [
        ...new Set([
          ...flags.filter((flag) => !/^\d+$/.test(flag)),
          ...readings.flatMap((reading) => reading.flags),
        ]),
      ],
    });
  }
  if (forms.length) return forms;
  const text = vocabularyLabel(word);
  const reading = word.readings.split(";")[0].split(",")[0];
  return [
    {
      text,
      segments: text === reading ? [{ text }] : [{ text, reading }],
      readings: [reading],
      pitchAccents: [],
      flags: [],
    },
  ];
}
