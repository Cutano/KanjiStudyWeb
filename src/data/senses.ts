import { isPartOfSpeechTag } from "./dictionary-tags";

export interface VocabularyGloss {
  text: string;
  notes: string[];
  tags: string[];
  references: string[];
}
export interface VocabularySense {
  number: number;
  partsOfSpeech: string[];
  tags: string[];
  glosses: VocabularyGloss[];
  /** Template order, including inline qualifiers and separators between gloss slots. */
  content: VocabularySenseContent[];
}
export interface VocabularySenseContent {
  kind: "gloss" | "text" | "note" | "tag" | "reference";
  /** Notes/references include source brackets; tags are unexpanded dictionary codes. */
  text: string;
}
type Token = { kind: "gloss" | "annotation" | "field" | "text"; text: string };
function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < template.length) {
    const opener = template[index];
    const closer =
      opener === "(" ? ")" : opener === "{" ? "}" : opener === "[" ? "]" : "";
    if (closer) {
      let end = index + 1,
        depth = 1;
      for (; end < template.length && depth; end += 1) {
        if (template[end] === opener) depth += 1;
        else if (template[end] === closer) depth -= 1;
      }
      if (!depth) {
        tokens.push({
          kind:
            opener === "(" ? "annotation" : opener === "{" ? "field" : "gloss",
          text: template.slice(index + 1, end - 1),
        });
        index = end;
        continue;
      }
    }
    const start = index++;
    while (index < template.length && !"({[".includes(template[index]))
      index += 1;
    tokens.push({ kind: "text", text: template.slice(start, index) });
  }
  return tokens;
}
const distinct = (values: string[]) => [...new Set(values)];

/** Separators adjacent to sense/POS markers belong to the surrounding template. */
function trimContent(
  content: VocabularySenseContent[],
): VocabularySenseContent[] {
  const result = [...content];
  while (result[0]?.kind === "text") {
    const text = result[0].text.replace(/^[\s,;]+/, "");
    if (text) {
      result[0] = { ...result[0], text };
      break;
    }
    result.shift();
  }
  while (result.at(-1)?.kind === "text") {
    const last = result.at(-1)!;
    const text = last.text.replace(/[\s,;]+$/, "");
    if (text) {
      result[result.length - 1] = { ...last, text };
      break;
    }
    result.pop();
  }
  return result;
}

/** Numbered sense boundaries and POS inheritance come from the template, not gloss slots. */
export function parseVocabularySenses(word: {
  meanings: string;
  meaningsTemplate: string;
  tags?: string;
}): VocabularySense[] {
  const meanings = word.meanings.split("|");
  const knownTags = new Set((word.tags || "").split(" "));
  const senses: VocabularySense[] = [];
  let activePOS: string[] = [];
  let numbered = false;
  let current: VocabularySense = {
    number: 1,
    partsOfSpeech: [],
    tags: [],
    glosses: [],
    content: [],
  };
  let pending: Omit<VocabularyGloss, "text"> = {
    notes: [],
    tags: [],
    references: [],
  };
  const annotate = (kind: "notes" | "tags" | "references", value: string) => {
    (current.glosses.at(-1) || pending)[kind].push(value);
    if (kind === "tags") current.tags.push(value);
  };
  for (const token of tokenize(word.meaningsTemplate)) {
    if (token.kind === "gloss" && /^\d+$/.test(token.text)) {
      const text = meanings[Number(token.text) - 1] ?? `[${token.text}]`;
      current.glosses.push({
        text,
        ...pending,
      });
      current.content.push({ kind: "gloss", text });
      pending = { notes: [], tags: [], references: [] };
      continue;
    }
    if (
      token.kind === "annotation" &&
      /^\d+$/.test(token.text) &&
      ((!numbered && !current.glosses.length && Number(token.text) === 1) ||
        (numbered && Number(token.text) === current.number + 1))
    ) {
      numbered = true;
      if (current.glosses.length) {
        senses.push(current);
        current = {
          number: Number(token.text),
          partsOfSpeech: [...activePOS],
          tags: [],
          glosses: [],
          content: [],
        };
      } else {
        current.number = Number(token.text);
        current.partsOfSpeech = [...activePOS];
      }
      continue;
    }
    const codes = token.text.split(",").map((code) => code.trim());
    if (token.kind === "annotation" && codes.every(isPartOfSpeechTag)) {
      activePOS = codes;
      if (!current.glosses.length) current.partsOfSpeech = [...activePOS];
      continue;
    }
    if (
      (token.kind === "annotation" || token.kind === "field") &&
      codes.every((code) => knownTags.has(code))
    ) {
      for (const [index, code] of codes.entries()) {
        annotate("tags", code);
        if (index) current.content.push({ kind: "text", text: " " });
        current.content.push({ kind: "tag", text: code });
      }
      continue;
    }
    if (token.kind === "text")
      current.content.push({ kind: "text", text: token.text });
    else {
      const brackets =
        token.kind === "field" ? "{}" : token.kind === "gloss" ? "[]" : "()";
      current.content.push({
        kind: /^(See|Ant)\s/.test(token.text) ? "reference" : "note",
        text: `${brackets[0]}${token.text}${brackets[1]}`,
      });
    }
    const content =
      token.kind === "text"
        ? token.text.replace(/^[\s,;]+|[\s,;]+$/g, "")
        : token.text;
    if (content)
      annotate(/^(See|Ant)\s/.test(content) ? "references" : "notes", content);
  }
  if (current.glosses.length) senses.push(current);
  if (!senses.length)
    return [
      {
        number: 1,
        partsOfSpeech: activePOS,
        tags: [],
        glosses: meanings.map((text) => ({
          text,
          notes: [],
          tags: [],
          references: [],
        })),
        content: meanings.flatMap((text, index) => [
          ...(index ? [{ kind: "text" as const, text: ", " }] : []),
          { kind: "gloss" as const, text },
        ]),
      },
    ];
  return senses.map((sense) => ({
    ...sense,
    partsOfSpeech: distinct(sense.partsOfSpeech),
    tags: distinct(sense.tags),
    content: trimContent(sense.content),
    glosses: sense.glosses.map((gloss) => ({
      ...gloss,
      tags: distinct(gloss.tags),
    })),
  }));
}
