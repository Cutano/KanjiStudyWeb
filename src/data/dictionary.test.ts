import { beforeAll, describe, expect, it } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { CatalogRepository } from "./repository";
import {
  dictionaryTagLabel,
  parseVocabularyForms,
  parseVocabularySenses,
  pitchMorae,
  plainSentence,
  vocabularyLabel,
} from "./text";

let repository: CatalogRepository;
let database: Database;
beforeAll(async () => {
  const sqlite = await initSqlJs();
  const manifest = JSON.parse(
    readFileSync("public/data/manifest.json", "utf8"),
  );
  database = new sqlite.Database(
    gunzipSync(readFileSync(`public${manifest.catalogPath}`)),
  );
  repository = new CatalogRepository(database);
});

describe("source dictionary presentation", () => {
  it("uses numbered senses rather than raw gloss-slot boundaries, inheriting POS correctly", () => {
    const birth = parseVocabularySenses(repository.getVocabulary(1378450));
    expect(birth).toHaveLength(12);
    expect(birth.flatMap((sense) => sense.glosses)).toHaveLength(14);
    expect(birth[0].partsOfSpeech).toEqual(["adjno", "n"]);
    expect(birth[1].partsOfSpeech).toEqual(["adjno", "n"]);
    expect(birth[2].glosses.map((gloss) => gloss.text)).toEqual([
      "unprotected",
      "raw, bareback",
    ]);
    expect(birth[5].partsOfSpeech).toEqual(["n"]);
    expect(birth[10].tags).toContain("arch");
    const above = parseVocabularySenses(repository.getVocabulary(1352130));
    expect(above).toHaveLength(12);
    expect(above.flatMap((sense) => sense.glosses)).toHaveLength(15);
    expect(above[3].partsOfSpeech).toEqual(["n", "adjno"]);
    expect(above[10].partsOfSpeech).toEqual(["suf"]);
    expect(above[10].glosses[0].references).toContain("See 父上");
    const school = parseVocabularySenses(repository.getVocabulary(1206730));
    expect(school).toEqual([
      {
        number: 1,
        partsOfSpeech: ["n"],
        tags: [],
        glosses: [{ text: "school", notes: [], tags: [], references: [] }],
        content: [{ kind: "gloss", text: "school" }],
      },
    ]);
  });
  it("preserves every gloss in the source corpus and keeps unknown notes intact", () => {
    const failures: number[] = [];
    for (const row of database.exec(
      "SELECT id,meanings,meanings_template,tags FROM dict_entry",
    )[0].values) {
      const meanings = String(row[1]);
      const parsed = parseVocabularySenses({
        meanings,
        meaningsTemplate: String(row[2]),
        tags: String(row[3]),
      });
      const expected = JSON.stringify(meanings.split("|"));
      const glosses = parsed.flatMap((sense) =>
        sense.glosses.map((gloss) => gloss.text),
      );
      const contentGlosses = parsed.flatMap((sense) =>
        sense.content
          .filter((part) => part.kind === "gloss")
          .map((part) => part.text),
      );
      if (
        JSON.stringify(glosses) !== expected ||
        JSON.stringify(contentGlosses) !== expected
      )
        failures.push(Number(row[0]));
    }
    expect(failures).toEqual([]);
    const noted = parseVocabularySenses({
      meanings: "first|second",
      meaningsTemplate:
        "(n) (1) [1] (unknown detail (nested)), (2) [2] {unrecognized-field}",
      tags: "n",
    });
    expect(noted[0].glosses[0].notes).toContain("unknown detail (nested)");
    expect(noted[1].glosses[0].notes).toContain("unrecognized-field");
    expect(dictionaryTagLabel("n")).toBe("Noun");
    expect(dictionaryTagLabel("v5r")).toBe("Godan verb in -ru");
    expect(dictionaryTagLabel("future-tag")).toBe("future-tag");
    expect(dictionaryTagLabel("nab")).toBe("Nagano dialect");
    const historical = parseVocabularySenses(repository.getVocabulary(1297140));
    expect(historical).toHaveLength(1);
    expect(historical[0].glosses[0].notes).toContain("1995");
    expect(historical[0].glosses[0].tags).toContain("hist");
    expect(historical[0].glosses[0].references).toContain("See 阪神淡路大震災");
  });
  it("preserves inline qualifiers and separators in template order within each real sense", () => {
    const content = (id: number) =>
      parseVocabularySenses(repository.getVocabulary(id));
    const display = (sense: ReturnType<typeof content>[number]) =>
      sense.content
        .map((part) =>
          part.kind === "tag"
            ? `(${dictionaryTagLabel(part.text)})`
            : part.text,
        )
        .join("")
        .replace(/\s+/g, " ");
    const charm = content(1001490);
    expect(charm).toHaveLength(2);
    expect(display(charm[1])).toBe(
      "code that is not (yet) necessary to understand, required boilerplate code (Usually written in kana) (Computing)",
    );
    const ivy = content(1014440);
    expect(ivy).toHaveLength(1);
    expect(display(ivy[0])).toBe(
      "(we) Ivy League (clothing) style (See アイビールック)",
    );
    const right = content(1171120);
    expect(right).toHaveLength(2);
    expect(display(right[1])).toBe(
      "right-hand side, right-hand direction, (on) the right",
    );
    expect(right[1].partsOfSpeech).toEqual(["n", "adjno"]);
    expect(display(right[0])).toBe("right hand");
  });
  it("retains per-reading pitch and flags and honors preferred kana forms", () => {
    const today = parseVocabularyForms(repository.getVocabulary(1579110));
    expect(
      today[0].readingDetails.map((reading) => [
        reading.text,
        reading.pitchAccents,
      ]),
    ).toEqual([
      ["きょう", [1]],
      ["こんにち", [1]],
    ]);
    expect(today[0].readingDetails[0].flags).toContain("gikun");
    expect(today[0].readingDetails[1].flags).not.toContain("gikun");
    expect(
      today[1].readingDetails.every(
        (reading) => reading.pitchAccents.length === 0,
      ),
    ).toBe(true);
    expect(today[0].flags).not.toContain("gikun");
    expect(vocabularyLabel(repository.getVocabulary(1289400))).toBe(
      "こんにちは",
    );
    expect(repository.getVocabulary(1289400).isUsuallyKana).toBe(true);
    expect(
      parseVocabularyForms(repository.getVocabulary(1352130))[0]
        .readingDetails[0].pitchAccents,
    ).toEqual([0, 2]);
  });
  it("renders mora-level unaccented, initial, medial and final patterns with particles", () => {
    expect(pitchMorae("きょう", 1)).toEqual({
      accent: 1,
      morae: [
        { text: "きょ", high: true },
        { text: "う", high: false },
      ],
      particleHigh: false,
    });
    expect(pitchMorae("がっこう", 0)?.morae.map((mora) => mora.high)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(pitchMorae("がっこう", 0)?.particleHigh).toBe(true);
    expect(pitchMorae("がっこう", 2)?.morae.map((mora) => mora.high)).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(pitchMorae("うえ", 2)?.morae.map((mora) => mora.high)).toEqual([
      false,
      true,
    ]);
    expect(pitchMorae("うえ", 2)?.particleHigh).toBe(false);
    expect(pitchMorae("ニュース", 1)?.morae.map((mora) => mora.text)).toEqual([
      "ニュ",
      "ー",
      "ス",
    ]);
    expect(pitchMorae("ん", 0)?.particleHigh).toBe(true);
    expect(pitchMorae("かな", 3)).toBeNull();
    expect(pitchMorae("学校", 0)).toBeNull();
  });
});

describe("word ordering and sentence detail", () => {
  it("prioritizes exact matches, JLPT levels, available examples and commonness", () => {
    expect(
      repository
        .searchVocabulary("今日")
        .items.slice(0, 5)
        .map((word) => word.id),
    ).toEqual([1579110, 1289400, 1289410, 2825510, 1289420]);
    expect(repository.searchVocabulary("漢字").items[0].id).toBe(1213170);
    expect(
      repository
        .getVocabulary(1213170)
        .characters.map((character) => character.glyph),
    ).toEqual(["漢", "字"]);
    expect(repository.searchVocabulary("学校").items[0].id).toBe(1206730);
    const learning = repository.searchVocabulary("学").items;
    expect(learning[0].entry).toBe("学");
    expect(learning[0].jlptLevel).toBe(3);
    expect(learning[1].jlptLevel).toBe(5);
    const school = repository.searchVocabulary("school").items;
    const educationIndex = school.findIndex((word) => word.entry === "教育");
    expect(educationIndex).toBeGreaterThan(0);
    expect(
      school.slice(0, educationIndex).every((word) => word.jlptLevel === 5),
    ).toBe(true);
    expect(school[educationIndex].jlptLevel).toBe(4);
  });
  it("exposes linked sentence words at normalized codepoint offsets", () => {
    const sentence = repository.getSentenceDetail(1);
    expect(plainSentence(sentence.text)).toBe("リンゴをもう一ついかがですか。");
    expect(
      sentence.vocabulary.map(({ word, start, length, text }) => [
        word.id,
        start,
        length,
        text,
      ]),
    ).toEqual([
      [1555480, 0, 3, "リンゴ"],
      [1012480, 4, 2, "もう"],
      [1160820, 6, 2, "一つ"],
      [2845606, 8, 3, "いかが"],
    ]);
    expect(
      sentence.characters.some((character) => character.glyph === "一"),
    ).toBe(true);
    expect(
      repository
        .getSentenceDetail(9163)
        .vocabulary.some((span) => span.length === 0 && span.text === ""),
    ).toBe(true);
    expect(repository.getSentenceDetail(3458).vocabulary).toEqual([]);
    expect(repository.getSentence(1)).toEqual({
      id: sentence.id,
      text: sentence.text,
      translation: sentence.translation,
    });
  });
});
