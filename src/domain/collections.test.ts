import { describe, expect, it } from "vitest";
import { createDefaultProfile } from "./study";
import {
  exportCollection,
  moveCollectionCharacters,
  parseCollectionImport,
  parseCsv,
  splitCollection,
} from "./collections";
import type { CustomSet } from "./types";

const source: CustomSet = {
  id: "source",
  name: "A collection",
  description: "Notes",
  keys: ["kanji:23398", "radical:23398", "kanji:134047"],
  createdAt: 1,
  updatedAt: 1,
};

describe("collection operations", () => {
  it("splits in order and keeps the original collection", () => {
    const profile = createDefaultProfile();
    profile.sets.push(structuredClone(source));
    let id = 0;
    expect(splitCollection(profile, source.id, 2, 5, () => String(++id))).toBe(
      2,
    );
    expect(profile.sets[0]).toEqual(source);
    expect(profile.sets.slice(1).map((set) => set.keys)).toEqual([
      source.keys.slice(0, 2),
      source.keys.slice(2),
    ]);
    expect(() => splitCollection(profile, source.id, 0, 5)).toThrow(
      "batch size",
    );
  });
  it("moves into the destination without duplicates and preserves character progress", () => {
    const profile = createDefaultProfile();
    profile.sets = [
      structuredClone(source),
      { ...source, id: "target", keys: ["radical:23398"] },
    ];
    moveCollectionCharacters(
      profile,
      "source",
      "target",
      ["kanji:23398", "radical:23398"],
      10,
    );
    expect(profile.sets[0]?.keys).toEqual(["kanji:134047"]);
    expect(profile.sets[1]?.keys).toEqual(["radical:23398", "kanji:23398"]);
    expect(profile.progress).toEqual({});
    expect(() =>
      moveCollectionCharacters(profile, "source", "source", source.keys, 10),
    ).toThrow("different destination");
  });
  it("round trips JSON identity, including radicals and supplementary characters", () => {
    expect(parseCollectionImport(exportCollection(source), "set.json")).toEqual(
      { name: source.name, description: source.description, keys: source.keys },
    );
    expect(() => parseCollectionImport('{"app":"other"}', "set.json")).toThrow(
      "version 1",
    );
  });
  it("parses real CSV quoting and supports old character-only exports", () => {
    expect(
      parseCsv(
        '\uFEFF"Character","Meaning"\r\n"学","learn, study\nwith ""care"""',
      ),
    ).toEqual([
      ["Character", "Meaning"],
      ["学", 'learn, study\nwith "care"'],
    ]);
    expect(
      parseCollectionImport(
        "Character,Meaning\n学,learn\n𠮟,scold",
        "Shared.csv",
      ).keys,
    ).toEqual(["kanji:23398", "kanji:134047"]);
    expect(
      parseCollectionImport("Character,Key\n子,radical:23398", "Radicals.csv")
        .keys,
    ).toEqual(["radical:23398"]);
    expect(() => parseCollectionImport('Character\n"学', "bad.csv")).toThrow(
      "unfinished",
    );
  });
});
