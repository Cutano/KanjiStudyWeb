# User-Supplied Extension Packs

## Purpose and Ownership

Extension packs add reading exercises and character explanations through a versioned JSON file. They are stored with the personal profile and work offline after import. This project does not supply KLC or Outlier text, infer proprietary content, or bypass a purchase control. Import material that you are entitled to use; the pack's author/license fields record the user's supplied provenance.

This is Kanji Study Web's own interchange format. It is not a claim of compatibility with an Android backup, KLC download, or Outlier product format.

## Version 1 Format

```json
{
  "schemaVersion": 1,
  "id": "my-study-notes",
  "name": "My Study Notes",
  "author": "Your name",
  "license": "Personal original notes",
  "readings": [
    {
      "id": "lesson-001",
      "code": 23398,
      "text": "日本語を学ぶ。",
      "translation": "Study Japanese."
    }
  ],
  "entries": [
    {
      "code": 23398,
      "explanation": "My personal memory cue for 学.",
      "etymology": "An optional, sourced note written by the pack author."
    }
  ]
}
```

The example contains original illustrative notes only. Save it as a UTF-8 `.json` file.

| Field                       | Meaning and validation                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`             | Exactly `1`. Future versions are rejected until a migration is implemented.                                                                             |
| `id`                        | Stable nonempty pack ID, at most 200 characters. Importing this ID again replaces the existing pack.                                                    |
| `name`, `author`, `license` | Nonempty text, each at most 200 characters.                                                                                                             |
| `readings`                  | Required array, which may be empty. Each reading has a unique nonempty ID, a Unicode scalar `code`, Japanese `text`, and `translation`.                 |
| `entries`                   | Required array, which may be empty. Each character code occurs at most once and has an `explanation`. `etymology` is optional.                          |
| `code`                      | Unicode code point as an integer, not a UTF-8 byte value, vocabulary ID, or character literal. `23398` is 学; supplementary-plane values are supported. |
| Content text                | Plain text, up to 100,000 characters per field. HTML is not an authoring format.                                                                        |

Each readings/entries array is limited to 100,000 items. The importer also limits input size. These bounds exist to prevent accidental import of an unrelated or impractically large file; a usual personal pack should be far smaller.

## Import and Update Behavior

Use the extension import action in settings and select the JSON file. The importer validates the entire file before beginning the profile transaction. Missing required fields, invalid codes, duplicate reading IDs, duplicate entry codes, and incompatible versions produce an error without changing existing data.

A new pack ID adds a pack. An existing ID replaces that pack atomically while preserving other packs, notes, progress, sets, and settings. Keep reading IDs stable when revising a pack so previously recorded reading completion can still refer to the same reading.

Imported packs are included in normal personal-profile backups. Their text is not added to the immutable source dictionary and does not modify `Resource/kanji.db`.

## Personal Backup Format

Personal backups are distinct from an extension file:

```json
{
  "app": "kanji-study-web",
  "schemaVersion": 1,
  "exportedAt": "2026-10-07T00:00:00.000Z",
  "profile": { "schemaVersion": 1 }
}
```

This abbreviated envelope is documentation, not an importable backup: a real profile includes every settings, progress, favorites, notes, overrides, sets, events, reading-progress, search-history, saved-session, and extension field. Generate backups through the application's export action. Restore replaces the validated profile in a single transaction; export the current profile first when it must be retained.

Implementation contracts are defined by `src/domain/types.ts` and validated in `src/state/validation.ts`. Changes to the format require a schema decision and compatibility fixtures.

## Collection Files

Collections can be exchanged independently of the personal profile. Use **Export JSON** in a collection, then **Import collection** on the collections page. Import creates a new collection without replacing progress or an existing collection. The v1 format is:

```json
{
  "app": "kanji-study-web-set",
  "schemaVersion": 1,
  "name": "My first characters",
  "description": "An ordered personal collection.",
  "keys": ["kanji:26085", "kanji:23398", "hiragana:12354"]
}
```

Names have 1–100 characters. Keys preserve character kind and ordering; duplicate keys are collected once, and every character must resolve in the installed catalog. Files are limited to 2 MiB. Import validates the complete file before writing the collection.

CSV exports retain the original Character, Meaning, On reading, and Kun reading columns and add a Key column for exact character identity. CSV import uses Key when present, or resolves the Character column for older exports. Quoted commas, quotes, and line breaks are supported. A CSV filename supplies the imported collection name. Vocabulary and sentence IDs are not collection character keys.

**Split into batches** creates smaller collections in the current order and keeps the original. **Copy selected** merges into another or a new collection without duplicates. **Move selected** writes the destination and source removal together in one durable transaction; character learning progress is unchanged.
