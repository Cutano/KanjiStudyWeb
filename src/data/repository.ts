import type { Database, BindParams, SqlValue } from "sql.js";
import type {
  CharacterDetail,
  CharacterKey,
  CharacterKind,
  CharacterQuery,
  CharacterSummary,
  Page,
  ProperName,
  Sentence,
  SentenceDetail,
  SequenceSystem,
  Vocabulary,
  VocabularyDetail,
} from "../domain/types";
import { plainSentence, vocabularyLabel } from "./text";
import { parseSearch, type SearchFilter, type SearchTerm } from "./search";

export const SEQUENCE_SYSTEMS: SequenceSystem[] = [
  "jouyou",
  "jouyou_revised",
  "jlpt",
  "jlpt_revised",
  "heisig",
  "heisig_revised",
  "kanken",
  "kanken_revised",
  "kklc",
  "freq",
  "hadamitzky",
  "kic",
];
type Row = Record<string, SqlValue>;
export interface PageOptions {
  offset?: number;
  limit?: number;
}
const text = (value: SqlValue | undefined) =>
  typeof value === "string" ? value : "";
const number = (value: SqlValue | undefined) =>
  typeof value === "number" ? value : 0;
const bounds = (options: PageOptions = {}) => ({
  offset: Math.max(0, Math.trunc(options.offset ?? 0)),
  limit: Math.min(10000, Math.max(1, Math.trunc(options.limit ?? 100))),
});
const pattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const hiragana = (value: string) =>
  value.replace(/[ァ-ヶ]/g, (character) =>
    String.fromCodePoint(character.codePointAt(0)! - 0x60),
  );
const katakana = (value: string) =>
  value.replace(/[ぁ-ゖ]/g, (character) =>
    String.fromCodePoint(character.codePointAt(0)! + 0x60),
  );
function charactersInTextOrder(
  characters: CharacterSummary[],
  source: string,
): CharacterSummary[] {
  const glyphs = Array.from(source);
  const position = (glyph: string) => {
    const index = glyphs.indexOf(glyph);
    return index === -1 ? glyphs.length : index;
  };
  return characters.sort(
    (left, right) => position(left.glyph) - position(right.glyph),
  );
}
function textCondition(
  term: SearchTerm,
  columns: string[],
  meaningColumn: string,
  parameters: SqlValue[],
): string {
  const selected = term.meaningOnly ? [meaningColumn] : columns;
  const forms = [
    ...new Set([term.text, hiragana(term.text), katakana(term.text)]),
  ];
  const condition = forms
    .flatMap(() =>
      selected.map((column) => `COALESCE(${column}, '') LIKE ? ESCAPE '\\'`),
    )
    .join(" OR ");
  parameters.push(
    ...forms.flatMap((form) => selected.map(() => pattern(form))),
  );
  return `${term.excluded ? "NOT " : ""}(${condition})`;
}

/** Alternatives within one dimension are a union; different dimensions intersect. */
function numberConditions(
  column: string,
  filters: SearchFilter<number>[],
  conditions: string[],
  parameters: SqlValue[],
) {
  for (const excluded of [false, true]) {
    const values = [
      ...new Set(
        filters
          .filter((filter) => filter.excluded === excluded)
          .map((filter) => filter.value),
      ),
    ];
    if (!values.length) continue;
    conditions.push(
      `${column} ${excluded ? "NOT IN" : "IN"} (${values.map(() => "?").join(",")})`,
    );
    parameters.push(...values);
  }
}

export function parseCharacterKey(key: CharacterKey): {
  kind: CharacterKind;
  code: number;
} {
  const match = /^(kanji|hiragana|katakana|radical):(\d+)$/.exec(key);
  if (!match || Number(match[2]) > 0x10ffff)
    throw new Error("Invalid character key.");
  return { kind: match[1] as CharacterKind, code: Number(match[2]) };
}

/** All SQL and source-specific conventions are isolated from application components. */
export class CatalogRepository {
  constructor(private readonly database: Database) {}

  private rows(sql: string, params: BindParams = []): Row[] {
    const statement = this.database.prepare(sql);
    try {
      statement.bind(params);
      const rows: Row[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }
  private scalar(sql: string, params: BindParams = []): number {
    return number(Object.values(this.rows(sql, params)[0] ?? {})[0]);
  }
  private summary(row: Row, kind: CharacterKind): CharacterSummary {
    const code = number(row.code);
    return {
      key: `${kind}:${code}`,
      kind,
      code,
      glyph: String.fromCodePoint(code),
      meaning: text(row.meaning),
      onReading: text(row.on_reading),
      kunReading: text(row.kun_reading),
      reading: text(row.reading),
      strokeCount: number(row.stroke_count),
      level: number(row.level),
      sequence: number(row.sequence),
    };
  }

  getCharacters(query: CharacterQuery = {}): Page<CharacterSummary> {
    if (query.keys?.length === 0) return { items: [], total: 0 };
    if (query.keys && !query.kind) {
      const kinds = [
        ...new Set(query.keys.map((key) => parseCharacterKey(key).kind)),
      ];
      const items = kinds.flatMap(
        (kind) =>
          this.getCharacters({ ...query, kind, offset: 0, limit: 10000 }).items,
      );
      const { offset, limit } = bounds(query);
      return {
        items: items.slice(offset, offset + limit),
        total: items.length,
      };
    }
    const kind = query.kind ?? "kanji";
    const system = SEQUENCE_SYSTEMS.includes(query.system ?? "jouyou")
      ? (query.system ?? "jouyou")
      : "jouyou";
    const table =
      kind === "radical" ? "radical" : kind === "kanji" ? "kanji" : "kana";
    const join = kind === "kanji" ? " JOIN kanji_sequence s USING(code)" : "";
    const level = kind === "kanji" ? `s.${system}_level` : "0";
    const sequence = kind === "kanji" ? `s.${system}_sequence` : "k.sequence";
    const conditions: string[] = [];
    const parameters: SqlValue[] = [];
    if (kind === "hiragana" || kind === "katakana") {
      conditions.push("k.is_katakana = ?");
      parameters.push(kind === "katakana" ? 1 : 0);
    }
    if (query.level !== undefined) {
      conditions.push(`${level} = ?`);
      parameters.push(query.level);
    }
    if (query.strokeCount !== undefined) {
      conditions.push("k.stroke_count = ?");
      parameters.push(query.strokeCount);
    }
    if (query.keys) {
      const codes = query.keys
        .map(parseCharacterKey)
        .filter((key) => key.kind === kind)
        .map((key) => key.code);
      if (!codes.length) return { items: [], total: 0 };
      conditions.push(`k.code IN (${codes.map(() => "?").join(",")})`);
      parameters.push(...codes);
    }
    for (const component of query.components ?? []) {
      if (kind !== "kanji") return { items: [], total: 0 };
      conditions.push(
        "EXISTS (SELECT 1 FROM kanji_radical_link l WHERE l.kanji_code = k.code AND l.radical_code = ?)",
      );
      parameters.push(component);
    }
    const search = parseSearch(query.query ?? "", "character");
    numberConditions("k.stroke_count", search.strokes, conditions, parameters);
    if (search.jlpt.length && kind !== "kanji") return { items: [], total: 0 };
    numberConditions("s.jlpt_level", search.jlpt, conditions, parameters);
    const columns = ["char(k.code)", "k.meaning", "k.reading"];
    if (kind === "kanji")
      columns.push(
        "REPLACE(k.on_reading, '.', '')",
        "REPLACE(k.kun_reading, '.', '')",
      );
    for (const term of search.terms)
      conditions.push(textCondition(term, columns, "k.meaning", parameters));
    const from = `FROM ${table} k${join}${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""}`;
    const total = this.scalar(`SELECT COUNT(*) ${from}`, parameters);
    const { offset, limit } = bounds(query);
    const rows = this.rows(
      `SELECT k.*, ${level} AS level, ${sequence} AS sequence ${from} ORDER BY ${sequence}, k.code LIMIT ? OFFSET ?`,
      [...parameters, limit, offset],
    );
    return { items: rows.map((row) => this.summary(row, kind)), total };
  }

  getCharacter(key: CharacterKey): CharacterDetail {
    const { kind, code } = parseCharacterKey(key);
    const table =
      kind === "kanji" ? "kanji" : kind === "radical" ? "radical" : "kana";
    const row = this.rows(`SELECT * FROM ${table} WHERE code = ?`, [code])[0];
    if (
      !row ||
      ((kind === "hiragana" || kind === "katakana") &&
        number(row.is_katakana) !== Number(kind === "katakana"))
    )
      throw new Error("This character is not in the installed catalog.");
    const extension =
      kind === "kanji" || kind === "radical"
        ? (this.rows(`SELECT * FROM extended_${table}_info WHERE code = ?`, [
            code,
          ])[0] ?? {})
        : {};
    const sequenceRow =
      kind === "kanji"
        ? this.rows("SELECT * FROM kanji_sequence WHERE code = ?", [code])[0]
        : undefined;
    const sequences: CharacterDetail["sequences"] = {};
    if (sequenceRow)
      for (const system of SEQUENCE_SYSTEMS)
        sequences[system] = {
          level: number(sequenceRow[`${system}_level`]),
          sequence: number(sequenceRow[`${system}_sequence`]),
        };
    const components =
      kind === "kanji"
        ? this.rows(
            "SELECT l.radical_code AS code, r.code AS radical_id, k.code AS kanji_id, l.occurrences, COALESCE(r.meaning, k.meaning) AS meaning FROM kanji_radical_link l LEFT JOIN radical r ON r.code=l.radical_code LEFT JOIN kanji k ON k.code=l.radical_code WHERE l.kanji_code=? ORDER BY l.radical_code",
            [code],
          ).map((component) => ({
            code: number(component.code),
            key:
              component.radical_id !== null
                ? (`radical:${number(component.radical_id)}` as CharacterKey)
                : component.kanji_id !== null
                  ? (`kanji:${number(component.kanji_id)}` as CharacterKey)
                  : null,
            glyph: String.fromCodePoint(number(component.code)),
            meaning: text(component.meaning),
            occurrences: number(component.occurrences),
          }))
        : [];
    return {
      ...this.summary(row, kind),
      paths: text(row.stroke_paths) ? text(row.stroke_paths).split("|") : [],
      components,
      decomposition: text(row.decomposition),
      classicalRadical: number(row.classical_radical)
        ? String.fromCodePoint(number(row.classical_radical))
        : "",
      nanori: text(extension.nanori),
      pinyin: text(extension.pinyin),
      korean: text(extension.korean_hangul),
      koreanRomanized: text(extension.korean_romaji),
      vietnamese: text(extension.vietnamese),
      variants: text(extension.alt_form ?? extension.variants),
      variantOf: number(row.variant_of_code)
        ? String.fromCodePoint(number(row.variant_of_code))
        : "",
      kangxiNumber:
        number(extension.kangxi) > 0 && number(extension.kangxi) <= 214
          ? number(extension.kangxi)
          : null,
      kangxiBase:
        number(extension.kangxi) > 214
          ? String.fromCodePoint(number(extension.kangxi))
          : "",
      radicalPosition: kind === "radical" ? number(extension.position) : null,
      isImportant: Boolean(extension.important),
      isArchaic: Boolean(row.is_archaic),
      isDiacritic: Boolean(row.is_diacritic),
      origin: text(row.origin),
      example: text(row.example),
      isKokuji: Boolean(extension.is_kokuji),
      isPhantom: Boolean(extension.is_phantom),
      sequences,
    };
  }

  private vocabulary(row: Row): Vocabulary {
    return {
      id: number(row.id),
      entry: text(row.entry),
      entryTemplate: text(row.entry_template),
      readings: text(row.readings),
      meanings: text(row.meanings),
      meaningsTemplate: text(row.meanings_template),
      tags: text(row.tags),
      isCommon: Boolean(row.is_common),
      isUsuallyKana: Boolean(row.is_usually_kana),
      jlptLevel: number(row.jlpt_level),
      audio: text(row.audio),
    };
  }
  private vocabularyPage(
    where: string,
    parameters: SqlValue[],
    options: PageOptions = {},
    exactTerms: string[] = [],
  ): Page<Vocabulary> {
    const { offset, limit } = bounds(options);
    const forms = [
      ...new Set(
        exactTerms.flatMap((term) => [term, hiragana(term), katakana(term)]),
      ),
    ];
    const exact = forms
      .map(
        () =>
          "(INSTR('|' || e.entry || '|', ?) > 0 OR INSTR(',' || LOWER(REPLACE(e.readings, ';', ',')) || ',', ?) > 0)",
      )
      .join(" OR ");
    const rankParameters = forms.flatMap((term) => [
      `|${term}|`,
      `,${term.toLowerCase()},`,
    ]);
    return {
      total: this.scalar(
        `SELECT COUNT(*) FROM dict_entry e WHERE ${where}`,
        parameters,
      ),
      items: this.rows(
        `SELECT e.* FROM dict_entry e WHERE ${where}
         ORDER BY ${exact ? `CASE WHEN ${exact} THEN 0 ELSE 1 END,` : ""} e.jlpt_level DESC,
           (SELECT COUNT(DISTINCT l.sentence_id) FROM sentence_vocab_link l WHERE l.vocab_id=e.id) DESC,
           e.is_common DESC, e.readings, e.id LIMIT ? OFFSET ?`,
        [...parameters, ...rankParameters, limit, offset],
      ).map((row) => this.vocabulary(row)),
    };
  }
  searchVocabulary(query: string, options: PageOptions = {}): Page<Vocabulary> {
    const search = parseSearch(query, "vocabulary");
    const conditions: string[] = [];
    const parameters: SqlValue[] = [];
    for (const term of search.terms)
      conditions.push(
        textCondition(
          term,
          ["e.entry", "e.readings", "e.meanings"],
          "e.meanings",
          parameters,
        ),
      );
    numberConditions("e.jlpt_level", search.jlpt, conditions, parameters);
    for (const filter of search.flags) {
      if (filter.value === "common") {
        conditions.push("e.is_common = ?");
        parameters.push(filter.excluded ? 0 : 1);
      } else
        conditions.push(
          `COALESCE(e.audio, '') ${filter.excluded ? "=" : "<>"} ''`,
        );
    }
    for (const filter of search.partsOfSpeech) {
      conditions.push(
        `${filter.excluded ? "NOT " : ""}(${filter.value.map(() => "(' ' || e.tags || ' ') LIKE ?").join(" OR ")})`,
      );
      parameters.push(...filter.value.map((tag) => `% ${tag} %`));
    }
    return this.vocabularyPage(
      conditions.length ? conditions.join(" AND ") : "1",
      parameters,
      options,
      search.terms
        .filter((term) => !term.excluded && !term.meaningOnly)
        .map((term) => term.text),
    );
  }

  getCharacterVocabulary(
    key: CharacterKey,
    options: PageOptions = {},
  ): Page<Vocabulary> {
    const { kind, code } = parseCharacterKey(key);
    if (kind === "hiragana" || kind === "katakana")
      return this.searchVocabulary(String.fromCodePoint(code), options);
    return this.vocabularyPage(
      "e.id IN (SELECT entry_id FROM dict_entry_kanji WHERE kanji_code=?)",
      [code],
      options,
    );
  }
  getVocabulary(id: number): VocabularyDetail {
    const row = this.rows("SELECT * FROM dict_entry WHERE id=?", [id])[0];
    if (!row)
      throw new Error("This vocabulary entry is not in the installed catalog.");
    const word = this.vocabulary(row);
    const preferred = vocabularyLabel(word);
    const writtenForm = /\p{Script=Han}/u.test(preferred)
      ? preferred
      : word.entry.split("|")[0];
    return {
      ...word,
      characters: charactersInTextOrder(
        this.rows(
          "SELECT DISTINCT k.* FROM kanji k JOIN dict_entry_kanji l ON l.kanji_code=k.code WHERE l.entry_id=? ORDER BY k.sequence",
          [id],
        ).map((kanji) => this.summary(kanji, "kanji")),
        writtenForm,
      ),
      sentences: this.rows(
        "SELECT DISTINCT s.* FROM sentence s JOIN sentence_vocab_link l ON l.sentence_id=s.id WHERE l.vocab_id=? ORDER BY s.id",
        [id],
      ).map(this.sentence),
      references: this.rows(
        "SELECT DISTINCT e.* FROM dict_entry e JOIN dict_entry_reference r ON r.entry_ref_id=e.id WHERE r.entry_id=? ORDER BY e.id",
        [id],
      ).map((entry) => this.vocabulary(entry)),
    };
  }
  private sentence(row: Row): Sentence {
    return {
      id: number(row.id),
      text: text(row.text),
      translation: text(row.translation),
    };
  }
  getSentence(id: number): Sentence {
    const row = this.rows("SELECT * FROM sentence WHERE id=?", [id])[0];
    if (!row) throw new Error("This sentence is not in the installed catalog.");
    return this.sentence(row);
  }
  getSentenceDetail(id: number): SentenceDetail {
    const sentence = this.getSentence(id);
    const characters = charactersInTextOrder(
      this.rows(
        "SELECT DISTINCT k.* FROM kanji k JOIN sentence_link l ON l.kanji_code=k.code WHERE l.sentence_id=? ORDER BY k.sequence",
        [id],
      ).map((character) => this.summary(character, "kanji")),
      plainSentence(sentence.text),
    );
    const plain = Array.from(plainSentence(sentence.text));
    const vocabulary = this.rows(
      "SELECT e.*, l.start_index, l.length FROM sentence_vocab_link l JOIN dict_entry e ON e.id=l.vocab_id WHERE l.sentence_id=? ORDER BY l.start_index, l.length DESC, e.id",
      [id],
    ).map((row) => {
      const start = number(row.start_index),
        length = number(row.length);
      return {
        word: this.vocabulary(row),
        start,
        length,
        text: plain.slice(start, start + length).join(""),
      };
    });
    return { ...sentence, characters, vocabulary };
  }
  getCharacterSentences(
    key: CharacterKey,
    options: PageOptions = {},
  ): Page<Sentence> {
    const { code } = parseCharacterKey(key);
    const { offset, limit } = bounds(options);
    return {
      total: this.scalar(
        "SELECT COUNT(*) FROM sentence_link WHERE kanji_code=?",
        [code],
      ),
      items: this.rows(
        "SELECT s.* FROM sentence s JOIN sentence_link l ON l.sentence_id=s.id WHERE l.kanji_code=? ORDER BY l.recommended DESC, s.id LIMIT ? OFFSET ?",
        [code, limit, offset],
      ).map(this.sentence),
    };
  }
  getCharacterNames(
    key: CharacterKey,
    options: PageOptions = {},
  ): Page<ProperName> {
    const { code } = parseCharacterKey(key);
    const { offset, limit } = bounds(options);
    return {
      total: this.scalar(
        "SELECT COUNT(*) FROM name_kanji_link WHERE kanji_code=?",
        [code],
      ),
      items: this.rows(
        "SELECT n.* FROM name n JOIN name_kanji_link l ON l.example_name_id=n.id WHERE l.kanji_code=? ORDER BY n.id LIMIT ? OFFSET ?",
        [code, limit, offset],
      ).map((row) => ({
        id: number(row.id),
        name: text(row.name),
        reading: text(row.reading),
        type: text(row.type),
      })),
    };
  }
  searchSentences(query: string, options: PageOptions = {}): Page<Sentence> {
    // The small sentence catalog permits normalized search without exposing the source markup.
    const value = query.trim().toLowerCase();
    const rows = this.rows("SELECT * FROM sentence ORDER BY id")
      .map(this.sentence)
      .filter(
        (sentence) =>
          !value ||
          plainSentence(sentence.text).includes(value) ||
          sentence.translation.toLowerCase().includes(value),
      );
    const { offset, limit } = bounds(options);
    return { total: rows.length, items: rows.slice(offset, offset + limit) };
  }
}
