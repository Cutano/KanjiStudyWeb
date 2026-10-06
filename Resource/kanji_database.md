# Kanji Database Structure and Statistics

`kanji.db` is a SQLite database containing Japanese kanji, radicals, kana, vocabulary, proper names, annotated example sentences, and stored learning statistics. It contains **7,045 character records**, **214,894 vocabulary entries**, **87,950 proper-name entries**, and **16,277 example sentences**. English glosses and translations are populated; selected character metadata also provides Korean, Mandarin, and Vietnamese readings.

This reference describes the adjacent `kanji.db` snapshot inspected on **2026-10-07**. Counts come from the stored rows, rather than estimates. Field interpretations that depend on undocumented application conventions are explicitly qualified. The database contains no application code, enum definitions, source attribution table, or release metadata establishing the original data sources or the exact versions of its study lists.

## Contents

- [Database file and schema conventions](#database-file-and-schema-conventions)
- [Table inventory](#table-inventory)
- [Logical relationships](#logical-relationships)
- [Column reference](#column-reference)
- [Text encodings](#text-encodings)
- [Content statistics](#content-statistics)
- [Integrity and data caveats](#integrity-and-data-caveats)
- [Query examples](#query-examples)
- [Index inventory](#index-inventory)
- [Exact table definitions](#exact-table-definitions)

## Database file and schema conventions

| Property | Value |
| --- | --- |
| File | kanji.db |
| Format | SQLite 3 |
| File size | 98,181,120 bytes (93.633 MiB) |
| Text encoding | UTF-8 |
| Tables | 18 application tables + 1 SQLite internal table |
| Application columns | 147; 149 including sqlite_sequence |
| Application rows | 1,263,974 across all 18 tables; this includes associations and statistics |
| Indexes | 52 explicitly created indexes: 16 unique and 36 non-unique |
| Views / triggers / declared foreign keys | 0 / 0 / 0 |
| Page size / page count | 4,096 bytes / 23,970 pages |
| Free-list pages | 0 |
| Journal mode / auto-vacuum | delete / 0 (disabled) |
| user_version / application_id | 0 / 0 |
| schema_version | 4,151; a SQLite schema counter, not an application release version |
| Integrity check | PRAGMA integrity_check returned ok |

SHA-256 of the inspected database:

```text
f0ab73a3a8d425455f93647c4305b76185d8156592df0cf534bbf4f7674ce4e6
```

The tables use ordinary SQLite row storage. Ten tables declare an integer primary key, including the autoincrementing `sentence_link.id`. Other tables rely on unique indexes or application logic. The unique indexes are separate from the integer primary keys.

No columns have explicit `NOT NULL` clauses or declared defaults, and there are no `CHECK` constraints. Integer primary keys provide their usual key semantics despite the absence of an explicit `NOT NULL` clause. Other columns that happen to be fully populated in this snapshot are not thereby guaranteed to remain non-NULL. `VARCHAR` columns have no declared length limits. `BOOLEAN` values are stored as integers; every populated boolean field currently contains only 0 or 1. `FLOAT` columns contain real values. No column stores BLOB data.

A `code` value denotes a Unicode code point, not a UTF-8 byte sequence or a table-relative row number. For example, `23398` is `学` and `134047` is `𠮟`. Some code points occur in both the kanji and radical catalogs; the table or `is_radical` discriminator is part of their identity. An `id` identifies a vocabulary, name, or sentence record and should not be converted to a character.

## Table inventory

| Table | Rows | Columns | Purpose |
| --- | --- | --- | --- |
| `kanji` | 7,045 | 17 | Character definitions, readings, components, stroke paths, and default ordering. |
| `extended_kanji_info` | 7,045 | 9 | One additional record per kanji, with other language readings and character flags. |
| `kanji_sequence` | 7,045 | 25 | Twelve alternative classification and ordering systems for every kanji. |
| `radical` | 265 | 10 | A selected catalog of radicals and component forms, with stroke paths. |
| `extended_radical_info` | 265 | 9 | One additional record per radical, with variants, language data, and classification. |
| `kanji_radical_link` | 40,558 | 3 | Searchable kanji-to-component associations and occurrence counts. |
| `kana` | 148 | 12 | Hiragana and katakana, including voiced and dataset-designated archaic forms. |
| `dict_entry` | 214,894 | 15 | Japanese vocabulary entries, English glosses, display templates, and lookup metadata. |
| `dict_entry_kanji` | 511,362 | 8 | Vocabulary-to-kanji associations with reading and example-selection metadata. |
| `dict_entry_reference` | 36,476 | 3 | Directed references between vocabulary entries. |
| `name` | 87,950 | 4 | Proper names, readings, and compact name-category codes. |
| `name_kanji_link` | 96,237 | 2 | Associations between kanji and selected proper-name examples. |
| `sentence` | 16,277 | 3 | Japanese example sentences with inline reading annotations and English translations. |
| `sentence_link` | 80,264 | 4 | Associations between sentences and kanji, with recommendation flags. |
| `sentence_vocab_link` | 63,502 | 4 | Vocabulary occurrences in sentences, including text spans. |
| `analytics` | 6,724 | 8 | Stored quiz and writing aggregates for kanji, kana, and radicals. |
| `quiz_mistake` | 10,814 | 6 | Stored wrong-answer associations and associated statistics. |
| `draw_mistake` | 77,103 | 5 | Stored stroke-level writing statistics. |
| `sqlite_sequence` | 1 | 2 | SQLite-managed AUTOINCREMENT counter for sentence_link. |

## Logical relationships

All relationships below are inferred from identifiers and verified against the rows. **SQLite declares no foreign keys**, so the database does not enforce these relationships or cascading deletion. `PRAGMA foreign_key_check` returns no rows because there are no declared foreign keys; the relationship checks below are separate joins.

| Child column | Parent column | Observed relationship |
| --- | --- | --- |
| extended_kanji_info.code | kanji.code | Exactly one extension record for every kanji. |
| kanji_sequence.code | kanji.code | Exactly one sequence record for every kanji. |
| extended_radical_info.code | radical.code | Exactly one extension record for every radical. |
| dict_entry_kanji.entry_id | dict_entry.id | Many reading/example associations per vocabulary entry. |
| dict_entry_kanji.kanji_code | kanji.code | Many vocabulary associations per kanji. |
| dict_entry_reference.entry_id and entry_ref_id | dict_entry.id | Directed vocabulary-to-vocabulary references. |
| name_kanji_link.example_name_id | name.id | Many-to-many name example association with kanji. |
| name_kanji_link.kanji_code | kanji.code | All referenced kanji are present. |
| sentence_link.sentence_id | sentence.id | Many-to-many sentence association with kanji. |
| sentence_link.kanji_code | kanji.code | All referenced kanji are present. |
| sentence_vocab_link.sentence_id | sentence.id | Vocabulary occurrences within sentences. |
| sentence_vocab_link.vocab_id | dict_entry.id | All referenced vocabulary entries are present. |
| kanji_radical_link.kanji_code | kanji.code | All referenced kanji are present. |
| kanji_radical_link.radical_code | Unicode component code point | Optional lookup in radical, then kanji; not a complete foreign-key relationship. |
| radical.variant_of_code | Base-form Unicode code point | 0 or a base glyph; the base may be absent from both catalogs. |
| analytics.code, quiz_mistake.code, draw_mistake.code | radical.code or kanji.code / kana.code | Use radical when is_radical = 1; otherwise use kanji or kana. |
| quiz_mistake.answer_code | Same radical/non-radical domain as the target | Every answer code resolves after including kana. |

`dict_entry_kanji` is an association with reading metadata, not a unique pair of entry and character. There are **18,349 repeated `(entry_id, kanji_code)` groups**, accounting for **19,651 rows beyond one row per pair**, but no duplicate complete eight-column rows. Preserve those reading variants, or use `DISTINCT` when counting vocabulary entries.

`kanji_radical_link` covers a broader component repertoire than the 265-row `radical` catalog: **1,894 distinct component codes** occur in the links. A `LEFT JOIN` is necessary to retain them. `kanji.classical_radical` is a separate representation: it contains a Unicode Kangxi Radical symbol such as `12070` (`⼦`), while the corresponding ordinary glyph `子` has code `23376`.

## Column reference

The following tables list every column in original schema order. “NULL / empty” reports the observed count of SQL `NULL` values and empty text strings, respectively. A zero count is an observation, not a declared constraint. “PK” marks the declared primary key; unique secondary keys are listed in the Index inventory.

### kanji

Table: `kanji` — **7,045 rows**. Character definitions, readings, components, stroke paths, and default ordering.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER · PK | 0 / 0 | Unicode code point; the character is obtained with SQLite char(code) or Python chr(code). Primary key. |
| `meaning` | VARCHAR | 157 / 0 | English gloss text; multiple glosses commonly use commas. |
| `custom_meaning` | VARCHAR | 7,045 / 0 | Custom meaning override slot; entirely NULL in this file. |
| `translation` | VARCHAR | 7,045 / 0 | Additional translation slot; entirely NULL. The English content is in meaning. |
| `on_reading` | VARCHAR | 190 / 0 | On readings, generally in katakana, with comma separators and application markers. |
| `custom_on_reading` | VARCHAR | 7,045 / 0 | Custom on-reading override slot; entirely NULL. |
| `kun_reading` | VARCHAR | 1,335 / 0 | Kun readings, generally in hiragana; periods mark an okurigana boundary in examples. |
| `custom_kun_reading` | VARCHAR | 7,045 / 0 | Custom kun-reading override slot; entirely NULL. |
| `reading` | VARCHAR | 28 / 0 | Space-separated romanized reading terms, apparently intended for lookup. |
| `radicals` | VARCHAR | 579 / 0 | Encoded component and stroke-assignment string; see Text encodings. |
| `notes` | VARCHAR | 7,045 / 0 | Notes slot; entirely NULL. |
| `classical_radical` | INTEGER | 0 / 0 | Unicode Kangxi Radical symbol code, or 0; this is not radical.code or a 1–214 ordinal. |
| `decomposition` | VARCHAR | 855 / 0 | Compact component decomposition; may include nested braces and supplementary characters. |
| `stroke_paths` | VARCHAR | 628 / 0 | Ordered SVG-style path strings separated by a vertical bar; NULL when unavailable. |
| `stroke_count` | INTEGER | 0 / 0 | Declared stroke count, 1–33. |
| `level` | INTEGER | 0 / 0 | Default level, 0–10; exactly equals kanji_sequence.jouyou_level in this file. |
| `sequence` | INTEGER | 0 / 0 | Default ordering, a permutation of 1–7,045; exactly equals jouyou_sequence. |

### extended kanji info

Table: `extended_kanji_info` — **7,045 rows**. One additional record per kanji, with other language readings and character flags.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER · PK | 0 / 0 | Primary key and logical one-to-one link to kanji.code. |
| `korean_romaji` | VARCHAR | 476 / 0 | Romanized Korean readings; multiple values can be comma-separated. |
| `korean_hangul` | VARCHAR | 751 / 0 | Korean readings in Hangul. |
| `pinyin` | VARCHAR | 220 / 0 | Mandarin readings using numeric tone notation, for example xue2. |
| `vietnamese` | VARCHAR | 271 / 0 | Vietnamese readings with diacritics; retain the stored Unicode text. |
| `nanori` | VARCHAR | 5,728 / 138 | Japanese name readings. There are 1,317 non-NULL values, but 138 are empty strings. |
| `alt_form` | VARCHAR | 6,319 / 0 | Alternative-form encoding with k or s prefixes; see Text encodings. |
| `is_kokuji` | BOOLEAN | 0 / 0 | Flag identifying entries marked as Japanese-created characters; 165 true values. |
| `is_phantom` | BOOLEAN | 0 / 0 | Dataset-specific phantom-character flag; 13 true values. Its selection criteria are not encoded. |

### kanji sequence

Table: `kanji_sequence` — **7,045 rows**. Twelve alternative classification and ordering systems for every kanji.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER · PK | 0 / 0 | Primary key and logical one-to-one link to kanji.code. |
| `jlpt_level` | INTEGER | 0 / 0 | jlpt classification/group code; 0 marks the unclassified tail of this ordering. |
| `jlpt_sequence` | INTEGER | 0 / 0 | jlpt ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `jlpt_revised_level` | INTEGER | 0 / 0 | jlpt_revised classification/group code; 0 marks the unclassified tail of this ordering. |
| `jlpt_revised_sequence` | INTEGER | 0 / 0 | jlpt_revised ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `jouyou_level` | INTEGER | 0 / 0 | jouyou classification/group code; 0 marks the unclassified tail of this ordering. |
| `jouyou_sequence` | INTEGER | 0 / 0 | jouyou ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `jouyou_revised_level` | INTEGER | 0 / 0 | jouyou_revised classification/group code; 0 marks the unclassified tail of this ordering. |
| `jouyou_revised_sequence` | INTEGER | 0 / 0 | jouyou_revised ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `heisig_level` | INTEGER | 0 / 0 | heisig classification/group code; 0 marks the unclassified tail of this ordering. |
| `heisig_sequence` | INTEGER | 0 / 0 | heisig ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `heisig_revised_level` | INTEGER | 0 / 0 | heisig_revised classification/group code; 0 marks the unclassified tail of this ordering. |
| `heisig_revised_sequence` | INTEGER | 0 / 0 | heisig_revised ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `kanken_level` | INTEGER | 0 / 0 | kanken classification/group code; 0 marks the unclassified tail of this ordering. |
| `kanken_sequence` | INTEGER | 0 / 0 | kanken ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `kanken_revised_level` | INTEGER | 0 / 0 | kanken_revised classification/group code; 0 marks the unclassified tail of this ordering. |
| `kanken_revised_sequence` | INTEGER | 0 / 0 | kanken_revised ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `kklc_level` | INTEGER | 0 / 0 | kklc classification/group code; 0 marks the unclassified tail of this ordering. |
| `kklc_sequence` | INTEGER | 0 / 0 | kklc ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `freq_level` | INTEGER | 0 / 0 | freq classification/group code; 0 marks the unclassified tail of this ordering. |
| `freq_sequence` | INTEGER | 0 / 0 | freq ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `hadamitzky_level` | INTEGER | 0 / 0 | hadamitzky classification/group code; 0 marks the unclassified tail of this ordering. |
| `hadamitzky_sequence` | INTEGER | 0 / 0 | hadamitzky ordering position; a unique permutation of 1–7,045, including unclassified entries. |
| `kic_level` | INTEGER | 0 / 0 | kic classification/group code; 0 marks the unclassified tail of this ordering. |
| `kic_sequence` | INTEGER | 0 / 0 | kic ordering position; a unique permutation of 1–7,045, including unclassified entries. |

### radical

Table: `radical` — **265 rows**. A selected catalog of radicals and component forms, with stroke paths.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER · PK | 0 / 0 | Unicode code point of the stored radical/component form; primary key. |
| `variant_of_code` | INTEGER | 0 / 0 | Base-form code point; 0 means no variant relationship. It is not a strict self-reference. |
| `reading` | VARCHAR | 25 / 0 | Japanese radical name/readings; NULL in 25 rows. |
| `custom_reading` | VARCHAR | 265 / 0 | Custom reading override slot; entirely NULL. |
| `meaning` | VARCHAR | 25 / 0 | English radical gloss; NULL in 25 rows. |
| `custom_meaning` | VARCHAR | 265 / 0 | Custom meaning override slot; entirely NULL. |
| `translation` | VARCHAR | 265 / 0 | Additional translation slot; entirely NULL. |
| `stroke_count` | INTEGER | 0 / 0 | Stroke count, 1–17. |
| `stroke_paths` | VARCHAR | 0 / 0 | Ordered vertical-bar-separated SVG-style paths; populated for all 265 rows. |
| `sequence` | INTEGER | 0 / 0 | Catalog ordering, a permutation of 1–265. |

### extended radical info

Table: `extended_radical_info` — **265 rows**. One additional record per radical, with variants, language data, and classification.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER · PK | 0 / 0 | Primary key and logical one-to-one link to radical.code. |
| `variants` | VARCHAR | 196 / 0 | Text containing alternative glyphs; some lists use comma-and-space separators. |
| `korean_romaji` | VARCHAR | 58 / 0 | Romanized Korean radical names, sometimes with mixed-script annotations. |
| `korean_hangul` | VARCHAR | 59 / 0 | Korean radical names in Hangul. |
| `pinyin` | VARCHAR | 58 / 0 | Mandarin radical reading, generally with tone diacritics rather than numeric tones. |
| `vietnamese` | VARCHAR | 58 / 0 | Vietnamese radical reading/name. |
| `kangxi` | INTEGER | 0 / 0 | Mixed representation: 214 rows contain values 1–214, 49 contain 0, and two contain base-form code points. |
| `position` | INTEGER | 0 / 0 | Position category 0–7; likely component-layout categories, not a stroke index. |
| `important` | BOOLEAN | 0 / 0 | Dataset importance flag; 69 true values. |

### kanji radical link

Table: `kanji_radical_link` — **40,558 rows**. Searchable kanji-to-component associations and occurrence counts.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `kanji_code` | INTEGER | 0 / 0 | Logical link to kanji.code. |
| `radical_code` | INTEGER | 0 / 0 | Component code point; many values have no row in radical or kanji. |
| `occurrences` | INTEGER | 0 / 0 | Number of occurrences of this component within the kanji; range 1–6. Components can overlap. |

### kana

Table: `kana` — **148 rows**. Hiragana and katakana, including voiced and dataset-designated archaic forms.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER · PK | 0 / 0 | Unicode code point of the kana; primary key. |
| `reading` | VARCHAR | 0 / 0 | Romanized reading, such as a or shi; shared by hiragana and katakana counterparts. |
| `example` | VARCHAR | 0 / 4 | Japanese example word; four stored values are empty. |
| `meaning` | VARCHAR | 0 / 4 | English meaning of the example word; four stored values are empty. |
| `translation` | VARCHAR | 148 / 0 | Additional translation slot; entirely NULL. |
| `origin` | VARCHAR | 0 / 2 | Source-character text; may contain more than one character. Two stored values are empty. |
| `is_katakana` | BOOLEAN | 0 / 0 | 0 for hiragana and 1 for katakana; 74 rows each. |
| `is_archaic` | BOOLEAN | 0 / 0 | Dataset archaic flag; six true values, including ゔ and ヴ. |
| `is_diacritic` | BOOLEAN | 0 / 0 | Dataset voicing/diacritic flag; 52 true values. |
| `stroke_count` | INTEGER | 0 / 0 | Stroke count, 1–6. |
| `stroke_paths` | VARCHAR | 0 / 0 | Ordered vertical-bar-separated SVG-style paths; populated in every row. |
| `sequence` | INTEGER | 0 / 0 | Ordering within each script, 0–73; the same sequence is used once in each script. |

### dict entry

Table: `dict_entry` — **214,894 rows**. Japanese vocabulary entries, English glosses, display templates, and lookup metadata.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `id` | INTEGER · PK | 0 / 0 | Integer entry identifier; primary key. Values are not consecutive and range from 1,000,000 to 9,999,999. |
| `entry` | VARCHAR | 0 / 40,749 | Written forms separated by vertical bars. Empty in 40,749 entries; consult entry_template and readings. |
| `entry_template` | VARCHAR | 0 / 0 | Encoded headword display template, including numbered form references, readings, and annotations. |
| `readings` | VARCHAR | 0 / 0 | Exactly one semicolon separates reading text from romanized lookup text in every row. |
| `meanings` | VARCHAR | 0 / 0 | English gloss segments; a vertical bar separates segments referenced by meanings_template. |
| `meanings_template` | VARCHAR | 0 / 0 | Display template with numbered gloss placeholders, grammatical/usage labels, and reference text. |
| `translation` | VARCHAR | 214,894 / 0 | Additional translation slot; entirely NULL. English glosses are stored in meanings. |
| `notes` | VARCHAR | 214,894 / 0 | Notes slot; entirely NULL. |
| `tags` | VARCHAR | 0 / 0 | Space-separated compact search/classification tags; includes lexical labels and numeric prefixed tokens. |
| `audio` | VARCHAR | 206,762 / 0 | Textual audio resource reference and label; 8,132 populated values. No audio binary is stored here. |
| `is_usually_kana` | BOOLEAN | 0 / 0 | Flag for words usually written in kana; 9,239 true values. |
| `exercise_count` | INTEGER | 0 / 0 | Stored counter; always 0 in this snapshot. |
| `jlpt_level` | INTEGER | 0 / 0 | Stored vocabulary level, 0–5. Treat 0 as unassigned; source/version of the level list is not recorded. |
| `sentence_count` | INTEGER | 0 / 0 | Stored counter; always 0 despite existing sentence_vocab_link rows. Compute actual counts from links. |
| `is_common` | BOOLEAN | 0 / 0 | Common-word flag; 22,553 true values. |

### dict entry kanji

Table: `dict_entry_kanji` — **511,362 rows**. Vocabulary-to-kanji associations with reading and example-selection metadata.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `entry_id` | INTEGER | 0 / 0 | Logical link to dict_entry.id. |
| `kanji_code` | INTEGER | 0 / 0 | Logical link to kanji.code. |
| `kanji_reading` | VARCHAR | 22,752 / 0 | Associated base reading; NULL in exactly the 22,752 rows with reading_type = 0. |
| `variant_reading` | VARCHAR | 465,368 / 0 | Context-dependent reading variant, such as がっ for ガク; 45,994 populated values. |
| `reading_type` | INTEGER | 0 / 0 | Observed enum: 0 = no assigned reading; samples indicate 1 = on reading and 2 = kun reading. |
| `is_headword_kanji` | BOOLEAN | 0 / 0 | Flag marking headword-kanji associations; 457,357 true values. |
| `is_recommended` | BOOLEAN | 0 / 0 | Recommended-example flag; 24,716 true values. |
| `is_example_reading` | BOOLEAN | 0 / 0 | Reading-example flag; 20,258 true values. |

### dict entry reference

Table: `dict_entry_reference` — **36,476 rows**. Directed references between vocabulary entries.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `entry_id` | INTEGER | 0 / 0 | Source vocabulary entry, logically referencing dict_entry.id. |
| `entry_ref_id` | INTEGER | 0 / 0 | Referenced vocabulary entry, logically referencing dict_entry.id. |
| `position` | INTEGER | 0 / 0 | Reference-position metadata, 9–1,367. Examples align with template offsets, but this is not universally safe. |

### name

Table: `name` — **87,950 rows**. Proper names, readings, and compact name-category codes.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `id` | INTEGER · PK | 0 / 0 | Integer proper-name identifier; primary key, with values 1–87,951 and one gap. |
| `name` | VARCHAR | 0 / 0 | Proper-name spelling; the same spelling can occur in multiple rows. |
| `reading` | VARCHAR | 0 / 0 | Japanese name reading text; alternatives may be separated by the Japanese delimiter 、. |
| `type` | VARCHAR | 0 / 20,674 | Compact category: empty string, f, l, m, p, or s. See category counts and inferred meanings below. |

### name kanji link

Table: `name_kanji_link` — **96,237 rows**. Associations between kanji and selected proper-name examples.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `kanji_code` | INTEGER | 0 / 0 | Logical link to kanji.code; indicates a selected name example for the character. |
| `example_name_id` | INTEGER | 0 / 0 | Logical link to name.id. The legacy column name does not refer to an example_name table. |

### sentence

Table: `sentence` — **16,277 rows**. Japanese example sentences with inline reading annotations and English translations.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `id` | INTEGER · PK | 0 / 0 | Integer sentence identifier; primary key. Values 1–16,309 contain 32 gaps. |
| `text` | VARCHAR | 0 / 0 | Japanese text with inline reading braces and U+3000 word separators; not plain display text. |
| `translation` | VARCHAR | 0 / 0 | English translation; populated for all 16,277 rows. |

### sentence link

Table: `sentence_link` — **80,264 rows**. Associations between sentences and kanji, with recommendation flags.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `id` | INTEGER · PK | 0 / 0 | INTEGER PRIMARY KEY AUTOINCREMENT; values 1–80,264. |
| `sentence_id` | INTEGER | 0 / 0 | Logical link to sentence.id. |
| `kanji_code` | INTEGER | 0 / 0 | Logical link to kanji.code. |
| `recommended` | BOOLEAN | 0 / 0 | Recommended example flag; 17,465 true values. |

### sentence vocab link

Table: `sentence_vocab_link` — **63,502 rows**. Vocabulary occurrences in sentences, including text spans.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `sentence_id` | INTEGER | 0 / 0 | Logical link to sentence.id. |
| `vocab_id` | INTEGER | 0 / 0 | Logical link to dict_entry.id; there is no separate vocab table. |
| `start_index` | INTEGER | 0 / 0 | Apparently a zero-based character offset in text after removing brace annotations and U+3000 separators; 0–27. |
| `length` | INTEGER | 0 / 0 | Length of the corresponding surface-text span; 0–11, with one zero-length record. |

### analytics

Table: `analytics` — **6,724 rows**. Stored quiz and writing aggregates for kanji, kana, and radicals.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER | 0 / 0 | Character code point; combine with is_radical to identify the record. |
| `is_radical` | BOOLEAN | 0 / 0 | 1 selects radical; 0 selects kanji or kana according to the code point. |
| `quiz_count` | INTEGER | 0 / 0 | Stored quiz count; observed range 0–756,739. Aggregation provenance is not recorded. |
| `quiz_accuracy` | FLOAT | 0 / 0 | Stored quiz accuracy on an observed 0–100 scale; the formula is not encoded. |
| `quiz_duration` | INTEGER | 0 / 0 | Stored duration statistic, 0–59,262; time unit and aggregation method are not encoded. |
| `writing_count` | INTEGER | 0 / 0 | Stored writing count, 0–717,781. |
| `writing_accuracy` | FLOAT | 0 / 0 | Stored writing score, approximately −10.3333 to 100; two values are negative. |
| `writing_mistakes` | FLOAT | 0 / 0 | Stored floating-point metric; always 0.0 in this file. |

### quiz mistake

Table: `quiz_mistake` — **10,814 rows**. Stored wrong-answer associations and associated statistics.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER | 0 / 0 | Target character code; resolve using is_radical and the kanji/kana catalogs. |
| `is_radical` | BOOLEAN | 0 / 0 | 1 for radical records; 0 for kanji or kana records. |
| `answer_code` | INTEGER | 0 / 0 | Wrong-answer character code, resolved in the same radical/non-radical domain. |
| `answer_count` | INTEGER | 0 / 0 | Stored count for this wrong answer, 2–85,912. |
| `percentage` | FLOAT | 0 / 0 | Stored percentage statistic, approximately 0.009154–100; its denominator is not documented. |
| `duration` | INTEGER | 0 / 0 | Stored duration statistic, 415–100,663; time unit and aggregation method are not encoded. |

### draw mistake

Table: `draw_mistake` — **77,103 rows**. Stored stroke-level writing statistics.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `code` | INTEGER | 0 / 0 | Target character code; resolve using is_radical and the kanji/kana catalogs. |
| `is_radical` | BOOLEAN | 0 / 0 | 1 for radical records; 0 for kanji or kana records. |
| `ordinal` | INTEGER | 0 / 0 | Apparent one-based stroke ordinal, 1–30; two records exceed the current kana stroke count. |
| `count` | INTEGER | 0 / 0 | Stored sample/attempt count for the stroke, 6–1,224,659; exact counting semantics are not encoded. |
| `avg_mistakes` | FLOAT | 0 / 0 | Stored average mistake metric, 0–approximately 7.085714. |

### sqlite sequence

Table: `sqlite_sequence` — **1 rows**. SQLite-managed AUTOINCREMENT counter for sentence_link.

| Column | Declared type | NULL / empty | Meaning and stored behavior |
| --- | --- | --- | --- |
| `name` | (untyped) | 0 / 0 | Name of the table using AUTOINCREMENT: sentence_link. |
| `seq` | (untyped) | 0 / 0 | Last stored generated identifier: 80,264. |

## Text encodings

### Character readings and alternative forms

Several text columns contain structured values rather than display-ready strings. For `学`, the stored values include:

```text
kanji.code                 23398
kanji.meaning              study, learning, science
kanji.on_reading           !ガク!
kanji.kun_reading          !まな.ぶ!
kanji.reading              gaku manabu
kanji.classical_radical    12070
kanji.radicals             *小0-2|⺍0-2|冖3,4|!子5-7
kanji.decomposition        ⺍冖子
extended_kanji_info.pinyin xue2
extended_kanji_info.nanori たか,のり
extended_kanji_info.alt_form k學
```

Comma-separated on/kun readings can include `!`, `*`, and periods. A period visibly separates the kanji-reading stem and its following kana in examples such as `まな.ぶ`. The meanings of the `!` and `*` flags are not defined by the schema; preserve them until an application parser establishes their semantics. The romanized `reading` field contains space-separated terms, rather than a display transcription of the marked reading strings.

`alt_form` has **362 values starting with `k`** and **364 starting with `s`**. Examples `万 → k萬` and `乘 → s乗` suggest old-form and simplified-form directions, respectively. This interpretation is inferred from pairs; the full grammar is not declared, and a value can contain more than a prefix and one glyph. Do not assume the target glyph has its own `kanji` row.

The two pinyin columns use different conventions: `extended_kanji_info.pinyin` includes numeric tones such as `xue2`, whereas `extended_radical_info.pinyin` includes diacritics such as `rén`.

### Stroke paths and component strings

`stroke_paths` contains SVG-style path commands beginning with `M` or `M `, separated by `|`. These are path-data strings, not complete SVG documents. Splitting on `|` gives one path per declared stroke for **every populated kanji, radical, and kana record**: 6,417 + 265 + 148 records. The corresponding path totals are **79,035**, **1,472**, and **437**, respectively.

`kanji.radicals` is a different format: entries associate component glyphs with stroke indexes, ranges, repeated occurrences, and optional flags. For `国`, `!囗0,1,7|玉2-6|王2-5|丶6` associates `囗` with strokes 0, 1, and 7, and associates overlapping components with other strokes. The indexes appear zero-based. Other rows also contain colons, and the full meaning of the flags is undocumented. Component counts are therefore not mutually exclusive partitions of a character's strokes.

`decomposition` contains glyph sequences and sometimes nested braces, for example `𮥶{𠂉一隹}見`. Treat it as a compact decomposition expression, not as a list of foreign keys. Component strings include supplementary Unicode and private-use characters, which may require suitable fonts or external glyph resources.

### Vocabulary templates and tags

A vocabulary record separates written forms, readings, gloss content, and formatting metadata:

```text
id              1160820
entry           一つ|一|１つ
entry_template  [1]:ひと つ|[2],io:ひとつ;[3]:ひと つ
readings        ひとつ;hitotsu
```

The `[n]` references in `entry_template` correspond to numbered written forms in examples; the template also supplies kana and annotations. There are **31,086 entries with multiple bar-separated forms**. Another **40,749 entries have an empty `entry`**, including kana words and iteration marks, while their templates and readings are populated. An empty `entry` does not mean the vocabulary record is empty.

All **214,894 `readings` values contain exactly one semicolon**. Examples indicate that the left portion supplies Japanese readings and the right supplies romanized lookup terms; each portion may itself contain comma-separated alternatives. The right portion can retain non-Latin symbols for symbol entries.

`meanings` uses `|` to separate gloss segments; **36,819 entries** contain this delimiter. `meanings_template` includes numbered placeholders such as `[1]`, grammatical tags, usage notes, and references. For example, entry 1000090 has the written forms `○|〇` and five gloss segments, with `[1]` through `[5]` in the template. Commas within a segment are part of the gloss text and should not automatically be treated as sense boundaries.

`tags` contains space-separated values such as `p0 p2 c2 k2 n` and `c5 k5 math n`. Tokens such as `n` and `math` visibly correspond to grammatical/domain labels. The numeric `p`, `c`, and `k` tokens and all other application flags need the original parser or enum definitions for authoritative interpretation.

`audio` contains strings such as `ba(keru)_06_j|お化け（おばけ）`. These are resource identifiers plus labels, not embedded audio or complete URLs. Resolving them requires resources outside this database.

`dict_entry_reference.position` behaves like an offset into `meanings_template` in simple examples: position 15 in entry 1000000 starts `一の字点` in `(unc) [1] (See 一の字点)`. However, **19 positions are at least the character length of the stored template**. The original offset convention or template transformations must be established before using this column directly for highlighting.

### Sentence annotations and vocabulary spans

Sentence 1 stores:

```text
Stored text:       リンゴ　を　もう　{ひと}一つ　いかが　です　か。
Plain text:        リンゴをもう一ついかがですか。
English:           Would you like another apple?
Vocabulary spans:  (0, 3) リンゴ; (4, 2) もう; (6, 2) 一つ; (8, 3) いかが
```

Braced text precedes the glyphs it annotates. A leading number appears to describe a multi-character span, as in `{2ことし}今年`. U+3000 ideographic spaces separate words or segments in the stored text.

The vocabulary offsets align with text after removing `{...}` annotations and U+3000 separators in the inspected examples. All **63,502 links** fit within the length of text normalized this way. This proves bounds consistency, not that every stored span is semantically correct. Those linked sentence texts contain no supplementary-plane characters, so this data cannot distinguish Unicode code-point offsets from UTF-16 code-unit offsets. Do not apply offsets directly to the raw annotated string.

A minimal normalization for plain-text inspection is:

```python
import re
plain_text = re.sub(r"\{[^}]*\}", "", stored_text).replace("\u3000", "")
```

This drops reading annotations. A furigana renderer should parse and retain them instead.

## Content statistics

### Kanji coverage

All percentages in this table use the **7,045 rows in `kanji`** as the denominator. “Populated” excludes both NULL and empty strings.

| Content | Populated | Coverage | Missing or empty |
| --- | --- | --- | --- |
| English meaning | 6,888 | 97.77% | 157 |
| On readings | 6,855 | 97.30% | 190 |
| Kun readings | 5,710 | 81.05% | 1,335 |
| Romanized lookup readings | 7,017 | 99.60% | 28 |
| Encoded components | 6,466 | 91.78% | 579 |
| Decomposition | 6,190 | 87.86% | 855 |
| Stroke paths | 6,417 | 91.09% | 628 |
| Korean romanization | 6,569 | 93.24% | 476 |
| Korean Hangul | 6,294 | 89.34% | 751 |
| Mandarin pinyin | 6,825 | 96.88% | 220 |
| Vietnamese readings | 6,774 | 96.15% | 271 |
| Nonempty nanori | 1,179 | 16.74% | 5,866 |
| Alternative forms | 726 | 10.31% | 6,319 |

There are **28 kanji records with neither on nor kun readings**, **165 kokuji flags**, and **13 phantom flags**. The catalog also includes symbols such as `々` and `〆`; its row count should not be read as a count of only ordinary Han ideographs. **Nine records** have code points above U+FFFF. Convert codes with `String.fromCodePoint` in JavaScript or `chr` in Python; `String.fromCharCode` cannot correctly construct those nine characters.

Stroke counts range from **1 to 33**, with a mean of **12.49** and median of **12**. The modal stroke count is **11** with **628 entries**. The two 33-stroke entries are `麤` and `龗`.

| Strokes | Kanji | Strokes | Kanji |
| --- | --- | --- | --- |
| 1 | 9 | 17 | 344 |
| 2 | 34 | 18 | 226 |
| 3 | 70 | 19 | 212 |
| 4 | 121 | 20 | 164 |
| 5 | 158 | 21 | 117 |
| 6 | 211 | 22 | 87 |
| 7 | 333 | 23 | 67 |
| 8 | 464 | 24 | 49 |
| 9 | 512 | 25 | 25 |
| 10 | 587 | 26 | 16 |
| 11 | 628 | 27 | 9 |
| 12 | 627 | 28 | 7 |
| 13 | 576 | 29 | 3 |
| 14 | 476 | 30 | 2 |
| 15 | 492 | 33 | 2 |
| 16 | 417 | — | — |

There are no records with 31 or 32 strokes. Seven `classical_radical` values are 0; the other **7,038** use codes U+2F00–U+2FD5, spanning all 214 Kangxi Radical symbols.

### Classification systems and ordering

Each of the twelve ordering systems supplies a level column and a sequence column. Every sequence column is a complete, unique permutation of **1–7,045**, including records whose level is 0. In every system, classified entries appear first and the level-0 records form the remaining tail. Therefore, a sequence value alone does not establish membership in that study list.

| Column prefix | Nonzero level range | Classified records | Level 0 records |
| --- | --- | --- | --- |
| `jlpt` | 1–5 | 2,226 | 4,819 |
| `jlpt_revised` | 1–5 | 2,232 | 4,813 |
| `jouyou` | 1–10 | 2,136 | 4,909 |
| `jouyou_revised` | 1–10 | 2,136 | 4,909 |
| `heisig` | 1–56 | 2,042 | 5,003 |
| `heisig_revised` | 1–56 | 2,200 | 4,845 |
| `kanken` | 1–12 | 6,355 | 690 |
| `kanken_revised` | 1–12 | 6,462 | 583 |
| `kklc` | 1–23 | 2,300 | 4,745 |
| `freq` | 1–20 | 2,000 | 5,045 |
| `hadamitzky` | 1–43 | 2,140 | 4,905 |
| `kic` | 1–7 | 2,136 | 4,909 |

The prefixes name the stored study/order systems. Exact editions and the mapping from application level codes to external course chapters or examination grades are not stored. In particular, the 0–12 Kanken codes should not be relabeled as official grades without the application's mapping.

The default `kanji.level` and `kanji.sequence` exactly match the non-revised `jouyou` pair for all 7,045 records. The non-revised Jōyō levels 1–6 contain **1,006** records; the revised levels 1–6 contain **1,026**. These are stored list partitions, not a claim that the database tracks the latest curriculum.

| Level code | Default and jouyou | jouyou revised |
| --- | --- | --- |
| 0 | 4,909 | 4,909 |
| 1 | 80 | 80 |
| 2 | 160 | 160 |
| 3 | 200 | 200 |
| 4 | 200 | 202 |
| 5 | 185 | 193 |
| 6 | 181 | 191 |
| 7 | 316 | 313 |
| 8 | 285 | 284 |
| 9 | 333 | 328 |
| 10 | 196 | 185 |

JLPT distributions are shown as raw level codes. Code 0 is unassigned. The non-revised and revised kanji labels differ for **396 records**; the vocabulary labels are a separate dataset.

| JLPT code | Kanji | Revised kanji | Vocabulary |
| --- | --- | --- | --- |
| 0 | 4,819 | 4,813 | 207,193 |
| 1 | 1,240 | 1,207 | 3,048 |
| 2 | 370 | 415 | 1,722 |
| 3 | 370 | 326 | 1,695 |
| 4 | 166 | 181 | 575 |
| 5 | 80 | 103 | 661 |

The `freq` system has 20 nonzero groups of 100 characters each. The `kklc` system has 23 groups of 100. Hadamitzky groups are mostly 50 characters, with 49 in group 27 and 41 in group 43. These regular groups are useful for pagination, but the stored sequence fields remain the authoritative ordering.

### Radicals and kana

| Metric | Value |
| --- | --- |
| Radical catalog size | 265 |
| Radical codes also in kanji | 256 |
| Radicals with reading and meaning fields individually populated | 240 each |
| Radicals with nonzero variant_of_code | 28 |
| Important radicals | 69 |
| Radicals with variants text | 69 |
| Component association rows | 40,558 |
| Distinct kanji with component associations | 6,466 |
| Distinct component codes | 1,894 |
| Component occurrences per association | 1–6 |
| Hiragana / katakana records | 74 / 74 |
| Kana with stroke paths | 148 / 148 |
| Kana marked archaic | 6 |
| Kana marked with diacritics | 52 |

The eight radical position codes appear to represent conventional layout locations. The labels below are inferred from representative glyphs; the database has no enum-description table.

| Position | Rows | Likely layout | Examples |
| --- | --- | --- | --- |
| 0 | 147 | Unspecified / standalone | 一, 人, 水 |
| 1 | 63 | Left | 亻, 氵, 扌 |
| 2 | 16 | Right | 刂, 攵, 頁 |
| 3 | 16 | Top | 宀, 艹, 雨 |
| 4 | 5 | Bottom | 心, 灬, 皿 |
| 5 | 5 | Upper-left enclosure | 厂, 广, 疒 |
| 6 | 3 | Lower-left enclosure | ⻌, 廴, 走 |
| 7 | 10 | Enclosing form | 囗, 門, 勹 |

The most widely linked components are counted below by distinct kanji-component pairs. Summed occurrences are a separate measure, since a component can appear more than once within a character.

| Component | Code point | Linked kanji | Total occurrences |
| --- | --- | --- | --- |
| 丿 | 20031 | 1,652 | 1,858 |
| 口 | 21475 | 1,605 | 1,937 |
| 一 | 19968 | 1,191 | 1,468 |
| 木 | 26408 | 730 | 796 |
| 人 | 20154 | 715 | 873 |
| 日 | 26085 | 666 | 699 |
| 十 | 21313 | 665 | 709 |
| 亠 | 20128 | 555 | 575 |
| 八 | 20843 | 555 | 573 |
| 丶 | 20022 | 518 | 569 |

Within each kana script, the database contains 46 entries with neither archaic nor diacritic flags, 25 with only the diacritic flag, two with only the archaic flag, and one with both. The archaic set is `ゐ`, `ゑ`, `ゔ`, `ヰ`, `ヱ`, and `ヴ`; these are application flags, not a general assertion about present-day usage. `ゐ`, `ゑ`, `ヰ`, and `ヱ` have empty example and meaning strings. `ゔ` and `ヴ` have empty origins.

### Vocabulary and name coverage

| Metric | Count | Scope |
| --- | --- | --- |
| Common vocabulary | 22,553 | 10.49% of vocabulary |
| Usually written in kana | 9,239 | 4.30% of vocabulary |
| Vocabulary with a nonzero JLPT label | 7,701 | 3.58% of vocabulary |
| Vocabulary with audio reference text | 8,132 | 3.78% of vocabulary |
| Vocabulary linked to at least one kanji | 172,310 | Distinct entry_id in dict_entry_kanji |
| Kanji linked to vocabulary | 5,834 | 1,211 kanji have no vocabulary link |
| Vocabulary-kanji association rows | 511,362 | Includes multiple readings of the same pair |
| Vocabulary reference rows | 36,476 | 32,042 distinct source entries; 27,919 distinct targets |
| Proper-name rows | 87,950 | 85,988 distinct name spellings |
| Kanji linked to names | 4,893 | 96,237 association rows; every name is linked |

Name category meanings are inferred from example values. The empty string is an unspecified category, not SQL NULL. Name associations are selected examples and should not be assumed to enumerate every character in every spelling.

| Type code | Rows | Likely meaning | Example |
| --- | --- | --- | --- |
| (empty) | 20,674 | Unspecified | 丁二 |
| f | 13,774 | Female given name | 一花 |
| l | 19,900 | Last name / surname | 一ノ渡 |
| m | 7,947 | Male given name | 太一 |
| p | 20,745 | Place name | 島橋西ノ丁 |
| s | 4,910 | Station name | 西８丁目駅 |

### Sentences and learning statistics

| Metric | Count |
| --- | --- |
| Sentences | 16,277 |
| Distinct annotated Japanese sentence texts | 16,276 |
| Distinct English translation strings | 16,071 |
| Sentence-kanji associations | 80,264 |
| Kanji covered by sentence links | 2,153 |
| Recommended sentence-kanji associations | 17,465 |
| Sentence-vocabulary associations | 63,502 |
| Sentences with vocabulary associations | 16,275 |
| Distinct linked vocabulary entries | 11,924 |

The learning tables contain aggregates without user identifiers or timestamps. Their collection period, contributor population, exact denominators, and duration units cannot be reconstructed from this schema. The totals below are sums of stored counters, not counts of identifiable users or independently verified practice events.

| Domain | Analytics records | Sum of quiz_count | Sum of writing_count |
| --- | --- | --- | --- |
| kana | 148 | 45,724,804 | 15,320,738 |
| kanji | 6,352 | 77,719,929 | 55,467,162 |
| radical | 224 | 4,824,126 | 2,190,821 |

| Domain | Quiz mistake rows | Distinct targets | Drawing statistic rows | Distinct targets |
| --- | --- | --- | --- | --- |
| kanji | 9,369 | 2,929 | 75,460 | 6,334 |
| kana | 608 | 144 | 439 | 148 |
| radical | 837 | 224 | 1,204 | 224 |

`analytics.quiz_accuracy` ranges from 0 to 100, but `writing_accuracy` ranges from approximately **−10.333333 to 100**. Thus the latter should not automatically be modeled as a probability. `quiz_duration` ranges from 0 to 59,262 and `quiz_mistake.duration` from 415 to 100,663, in unspecified stored units. Do not label them as milliseconds or seconds without application evidence. `writing_mistakes` is always 0.0; nonzero per-stroke information is present in `draw_mistake.avg_mistakes` instead.

### Storage distribution

The following sizes include each table and all indexes attached to it, using SQLite page allocation. They are not the size of exported text. The five largest table families occupy most of the file.

| Table and its indexes | Bytes | MiB |
| --- | --- | --- |
| dict_entry | 39,149,568 | 37.336 |
| dict_entry_kanji | 25,743,360 | 24.551 |
| kanji | 8,982,528 | 8.566 |
| name_kanji_link | 3,481,600 | 3.320 |
| name | 3,325,952 | 3.172 |

## Integrity and data caveats

### Verified checks

- SQLite `integrity_check` returns `ok`.
- Every ordinary vocabulary, name, sentence, and kanji link listed above resolves to its expected parent. Both kanji extension tables and the radical extension table have complete one-to-one coverage.
- Every analytics, quiz target, quiz answer, and drawing code resolves when non-radical records are checked against both `kanji` and `kana`.
- No complete duplicate rows were found in `dict_entry_kanji`, `dict_entry_reference`, or `sentence_vocab_link`. No duplicate logical pairs were found in `name_kanji_link` or `sentence_link`; `kanji_radical_link` pairs are constrained by a unique index.
- Every populated stroke-path string has exactly the declared number of bar-separated paths. All twelve kanji sequence columns cover 1–7,045 without duplicates or gaps.

### Incomplete catalogs and exceptional values

| Item | Observed result | Consequence |
| --- | --- | --- |
| Component codes outside the radical catalog | 10,258 link rows use 1,629 distinct codes absent from `radical`. Of these, 4,429 rows use 592 codes absent from both `radical` and `kanji`. | Keep component associations with a left join and fall back to the code point. These are not automatically corrupt rows. |
| Private-use and placeholder components | 416 link rows use 41 private-use codes in U+E000–U+F8FF; 97 rows use `？`. | Standard fonts and ordinary radical lookups may not provide a meaningful glyph or label. |
| Variant base lookup | Seven nonzero `variant_of_code` values fail a radical-only lookup; one row, `戸 → 戶` (25142), also lacks a kanji record for the base. | Variant relationships do not justify a mandatory self-foreign-key constraint. |
| Mixed Kangxi field | `extended_radical_info.kangxi` is 32769 for `耂` and 39135 for `飠`; those values denote `老` and `食`. The other values are 0 or 1–214. | Do not uniformly interpret this field as a Kangxi ordinal. |
| Missing stroke paths | 628 kanji have no paths, despite a populated stroke count. | Provide a fallback for stroke animation or handwriting views. |
| Empty nanori | 138 values are empty strings, alongside 5,728 NULLs. | Use both NULL and empty checks when measuring reading coverage. |
| Unpopulated customization and translation slots | All custom-reading/custom-meaning columns and all `translation` columns except `sentence.translation` are NULL; kanji and vocabulary notes are also NULL. | Use the populated English gloss fields. These slots do not supply a second translation language. |
| Inactive dictionary counters | Every `dict_entry.exercise_count` and `dict_entry.sentence_count` is 0. | Count actual sentence links instead of relying on the cached counter. |
| Negative writing scores | `僖`: approximately −4.388888; `鶚`: approximately −10.333333. | Preserve source values and handle them explicitly in charts or scoring code. |
| Stroke-statistic mismatch | `draw_mistake` contains ordinals 2 and 3 for `ん`, whose current kana stroke count is 1. | Statistics may not align perfectly with the current stroke catalog. |
| Missing vocabulary links | Sentences 3458 and 8404 have no `sentence_vocab_link` rows. | Sentence text and translations remain available without vocabulary highlighting. |
| Zero-length span | Sentence 9163, vocabulary 1208640 (`滑る`), starts at 4 with length 0. | Do not assume all linked spans have positive length. |
| Repeated sentence text | Sentence IDs 2282 and 15865 share the same annotated Japanese text. | IDs identify records; sentence text is not unique. |
| Reference-position exceptions | 19 `dict_entry_reference.position` values are at least the length of their stored meaning template. | Check the parser/offset convention before creating inline links. |

ID ranges also contain gaps. Do not use `MAX(id)` as a row count or iterate by assuming every intermediate ID exists. The observed unique name spellings and sentence texts are not protected by unique indexes.

## Query examples

Run the CLI examples from the `Resource` directory. Opening the source read-only prevents accidental changes:

```sh
sqlite3 -readonly kanji.db
```

### Inspect schema and counts

```sql
SELECT type, name, tbl_name, sql
FROM sqlite_schema
ORDER BY type, name;

PRAGMA table_info(kanji);
PRAGMA index_list(kanji_sequence);
PRAGMA integrity_check;

SELECT 'kanji' AS entity, COUNT(*) AS rows FROM kanji
UNION ALL SELECT 'vocabulary', COUNT(*) FROM dict_entry
UNION ALL SELECT 'names', COUNT(*) FROM name
UNION ALL SELECT 'sentences', COUNT(*) FROM sentence;
```

### Retrieve a character and its extended information

```sql
SELECT k.code, char(k.code) AS character, k.meaning,
       k.on_reading, k.kun_reading, k.stroke_count,
       e.pinyin, e.korean_hangul, e.vietnamese, e.nanori,
       s.jlpt_revised_level, s.jouyou_revised_level
FROM kanji AS k
LEFT JOIN extended_kanji_info AS e USING (code)
LEFT JOIN kanji_sequence AS s USING (code)
WHERE k.code = unicode('学');
```

### Retrieve vocabulary examples without duplicating entries

```sql
SELECT DISTINCT e.id, e.entry, e.entry_template,
       e.readings, e.meanings, e.jlpt_level, e.is_common
FROM dict_entry_kanji AS l
JOIN dict_entry AS e ON e.id = l.entry_id
WHERE l.kanji_code = unicode('学')
  AND l.is_recommended = 1
ORDER BY e.is_common DESC, e.id
LIMIT 20;
```

Include `kanji_reading`, `variant_reading`, and `reading_type` when individual reading associations are needed; multiple rows per vocabulary entry can then be expected.

### Retrieve components without dropping uncataloged glyphs

```sql
SELECT l.radical_code, char(l.radical_code) AS component,
       l.occurrences,
       COALESCE(r.meaning, component_kanji.meaning) AS meaning
FROM kanji_radical_link AS l
LEFT JOIN radical AS r ON r.code = l.radical_code
LEFT JOIN kanji AS component_kanji ON component_kanji.code = l.radical_code
WHERE l.kanji_code = unicode('学')
ORDER BY l.radical_code;
```

This retrieves component associations, not their stroke order. Use `kanji.radicals` for encoded stroke assignments.

### Retrieve sentences and compute actual vocabulary coverage

```sql
SELECT s.id, s.text, s.translation, l.recommended
FROM sentence_link AS l
JOIN sentence AS s ON s.id = l.sentence_id
WHERE l.kanji_code = unicode('学')
ORDER BY l.recommended DESC, s.id
LIMIT 20;

SELECT vocab_id,
       COUNT(*) AS occurrence_links,
       COUNT(DISTINCT sentence_id) AS actual_sentence_count
FROM sentence_vocab_link
WHERE vocab_id = 1160820
GROUP BY vocab_id;
```

### Retrieve a classified study list in its stored order

```sql
SELECT char(k.code) AS character, k.meaning,
       s.jlpt_revised_level, s.jlpt_revised_sequence
FROM kanji_sequence AS s
JOIN kanji AS k USING (code)
WHERE s.jlpt_revised_level = 5
ORDER BY s.jlpt_revised_sequence;
```

Use `level > 0` when retrieving the entire classified portion of a system; simply sorting all rows by sequence also includes its unclassified tail.

### Resolve analytics across all character domains

```sql
SELECT a.code, char(a.code) AS character,
       CASE WHEN a.is_radical = 1 THEN 'radical'
            WHEN k.code IS NOT NULL THEN 'kanji'
            WHEN n.code IS NOT NULL THEN 'kana'
            ELSE 'unresolved' END AS category,
       a.quiz_count, a.quiz_accuracy, a.writing_count, a.writing_accuracy
FROM analytics AS a
LEFT JOIN kanji AS k ON a.is_radical = 0 AND k.code = a.code
LEFT JOIN kana AS n ON a.is_radical = 0 AND n.code = a.code
LEFT JOIN radical AS r ON a.is_radical = 1 AND r.code = a.code
ORDER BY a.quiz_count DESC
LIMIT 20;
```

### Open the database read-only in Python

```python
from pathlib import Path
import sqlite3

# Run from Resource, or replace this with the database's absolute path.
path = Path("kanji.db").resolve()
with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as connection:
    connection.row_factory = sqlite3.Row
    row = connection.execute(
        "SELECT code, meaning, stroke_paths FROM kanji WHERE code = ?",
        (ord("学"),),
    ).fetchone()
    character = chr(row["code"])
    strokes = row["stroke_paths"].split("|") if row["stroke_paths"] else []
    print(character, row["meaning"], len(strokes))
```

## Index inventory

These are all 52 declared indexes, with columns in indexed order. Primary-key access through the integer row key is additional and does not appear as a separate named index. There is no full-text-search virtual table or text index on meanings/readings; a broad substring search over those fields requires scanning or a separate search structure.

| Index | Table | Columns | Unique |
| --- | --- | --- | --- |
| `analytics_code_idx` | `analytics` | code, is_radical | Yes |
| `dict_entry_kanji_entry_id_idx` | `dict_entry_kanji` | entry_id | No |
| `dict_entry_kanji_kanji_code_idx` | `dict_entry_kanji` | kanji_code | No |
| `dict_entry_reference_entry_id_idx` | `dict_entry_reference` | entry_id | No |
| `draw_mistake_code_idx` | `draw_mistake` | code, is_radical, ordinal | Yes |
| `example_name_kanji_example_name_idx` | `name_kanji_link` | example_name_id | No |
| `example_name_kanji_kanji_idx` | `name_kanji_link` | kanji_code | No |
| `kana_is_archaic_idx` | `kana` | is_archaic | No |
| `kana_is_diacritic_idx` | `kana` | is_diacritic | No |
| `kana_is_katakana_idx` | `kana` | is_katakana | No |
| `kana_sequence_idx` | `kana` | sequence | No |
| `kana_stroke_count_idx` | `kana` | stroke_count | No |
| `kanji_level_idx` | `kanji` | level | No |
| `kanji_radical_idx` | `kanji_radical_link` | kanji_code, radical_code | Yes |
| `kanji_radical_kanji_idx` | `kanji_radical_link` | kanji_code | No |
| `kanji_radical_radical_idx` | `kanji_radical_link` | radical_code | No |
| `kanji_sequence_freq_level_idx` | `kanji_sequence` | freq_level | No |
| `kanji_sequence_freq_sequence_idx` | `kanji_sequence` | freq_sequence | Yes |
| `kanji_sequence_hadamitzky_level_idx` | `kanji_sequence` | hadamitzky_level | No |
| `kanji_sequence_hadamitzky_sequence_idx` | `kanji_sequence` | hadamitzky_sequence | Yes |
| `kanji_sequence_heisig_level_idx` | `kanji_sequence` | heisig_level | No |
| `kanji_sequence_heisig_revised_level_idx` | `kanji_sequence` | heisig_revised_level | No |
| `kanji_sequence_heisig_revised_sequence_idx` | `kanji_sequence` | heisig_revised_sequence | Yes |
| `kanji_sequence_heisig_sequence_idx` | `kanji_sequence` | heisig_sequence | Yes |
| `kanji_sequence_idx` | `kanji` | sequence | No |
| `kanji_sequence_jlpt_level_idx` | `kanji_sequence` | jlpt_level | No |
| `kanji_sequence_jlpt_revised_level_idx` | `kanji_sequence` | jlpt_revised_level | No |
| `kanji_sequence_jlpt_revised_sequence_idx` | `kanji_sequence` | jlpt_revised_sequence | Yes |
| `kanji_sequence_jlpt_sequence_idx` | `kanji_sequence` | jlpt_sequence | Yes |
| `kanji_sequence_jouyou_level_idx` | `kanji_sequence` | jouyou_level | No |
| `kanji_sequence_jouyou_revised_level_idx` | `kanji_sequence` | jouyou_revised_level | No |
| `kanji_sequence_jouyou_revised_sequence_idx` | `kanji_sequence` | jouyou_revised_sequence | Yes |
| `kanji_sequence_jouyou_sequence_idx` | `kanji_sequence` | jouyou_sequence | Yes |
| `kanji_sequence_kanken_level_idx` | `kanji_sequence` | kanken_level | No |
| `kanji_sequence_kanken_revised_level_idx` | `kanji_sequence` | kanken_revised_level | No |
| `kanji_sequence_kanken_revised_sequence_idx` | `kanji_sequence` | kanken_revised_sequence | Yes |
| `kanji_sequence_kanken_sequence_idx` | `kanji_sequence` | kanken_sequence | Yes |
| `kanji_sequence_kic_level_idx` | `kanji_sequence` | kic_level | No |
| `kanji_sequence_kic_sequence_idx` | `kanji_sequence` | kic_sequence | Yes |
| `kanji_sequence_kklc_level_idx` | `kanji_sequence` | kklc_level | No |
| `kanji_sequence_kklc_sequence_idx` | `kanji_sequence` | kklc_sequence | Yes |
| `kanji_stroke_count_idx` | `kanji` | stroke_count | No |
| `quiz_mistake_answer_count_idx` | `quiz_mistake` | answer_count | No |
| `quiz_mistake_entry_idx` | `quiz_mistake` | code, is_radical, answer_code | Yes |
| `radical_sequence_idx` | `radical` | sequence | No |
| `radical_stroke_count_idx` | `radical` | stroke_count | No |
| `search_sort_idx` | `dict_entry` | jlpt_level, sentence_count, is_common | No |
| `sentence_link_kanji_code_idx` | `sentence_link` | kanji_code | No |
| `sentence_link_sentence_id_idx` | `sentence_link` | sentence_id | No |
| `sentence_vocab_link_sentence_id_idx` | `sentence_vocab_link` | sentence_id | No |
| `sentence_vocab_link_vocab_id_idx` | `sentence_vocab_link` | vocab_id | No |
| `variant_of_code_idx` | `radical` | variant_of_code | No |

The index names beginning with `example_name_kanji_` belong to `name_kanji_link`; they retain older terminology. `search_sort_idx` indexes `(jlpt_level, sentence_count, is_common)`, even though `sentence_count` is constant in this snapshot. The single-column link indexes support lookups from either endpoint where both are present. Only `entry_id` is indexed in `dict_entry_reference`, so reverse-reference lookups by `entry_ref_id` do not have a dedicated index.

## Exact table definitions

These are the stored table definitions from `sqlite_schema`, reformatted for readability while preserving the original types and constraints. `sqlite_sequence` is included for inspection only; SQLite creates and manages it automatically when an AUTOINCREMENT table is used.

```sql
CREATE TABLE `kanji` (
    `code` INTEGER,
    `meaning` VARCHAR,
    `custom_meaning` VARCHAR,
    `translation` VARCHAR,
    `on_reading` VARCHAR,
    `custom_on_reading` VARCHAR,
    `kun_reading` VARCHAR,
    `custom_kun_reading` VARCHAR,
    `reading` VARCHAR,
    `radicals` VARCHAR,
    `notes` VARCHAR,
    `classical_radical` INTEGER,
    `decomposition` VARCHAR,
    `stroke_paths` VARCHAR,
    `stroke_count` INTEGER,
    `level` INTEGER,
    `sequence` INTEGER,
    PRIMARY KEY (`code`)
);
```

```sql
CREATE TABLE `extended_kanji_info` (
    `code` INTEGER,
    `korean_romaji` VARCHAR,
    `korean_hangul` VARCHAR,
    `pinyin` VARCHAR,
    `vietnamese` VARCHAR,
    `nanori` VARCHAR,
    `alt_form` VARCHAR,
    `is_kokuji` BOOLEAN,
    `is_phantom` BOOLEAN,
    PRIMARY KEY (`code`)
);
```

```sql
CREATE TABLE `kanji_sequence` (
    `code` INTEGER,
    `jlpt_level` INTEGER,
    `jlpt_sequence` INTEGER,
    `jlpt_revised_level` INTEGER,
    `jlpt_revised_sequence` INTEGER,
    `jouyou_level` INTEGER,
    `jouyou_sequence` INTEGER,
    `jouyou_revised_level` INTEGER,
    `jouyou_revised_sequence` INTEGER,
    `heisig_level` INTEGER,
    `heisig_sequence` INTEGER,
    `heisig_revised_level` INTEGER,
    `heisig_revised_sequence` INTEGER,
    `kanken_level` INTEGER,
    `kanken_sequence` INTEGER,
    `kanken_revised_level` INTEGER,
    `kanken_revised_sequence` INTEGER,
    `kklc_level` INTEGER,
    `kklc_sequence` INTEGER,
    `freq_level` INTEGER,
    `freq_sequence` INTEGER,
    `hadamitzky_level` INTEGER,
    `hadamitzky_sequence` INTEGER,
    `kic_level` INTEGER,
    `kic_sequence` INTEGER,
    PRIMARY KEY (`code`)
);
```

```sql
CREATE TABLE `radical` (
    `code` INTEGER,
    `variant_of_code` INTEGER,
    `reading` VARCHAR,
    `custom_reading` VARCHAR,
    `meaning` VARCHAR,
    `custom_meaning` VARCHAR,
    `translation` VARCHAR,
    `stroke_count` INTEGER,
    `stroke_paths` VARCHAR,
    `sequence` INTEGER,
    PRIMARY KEY (`code`)
);
```

```sql
CREATE TABLE `extended_radical_info` (
    `code` INTEGER,
    `variants` VARCHAR,
    `korean_romaji` VARCHAR,
    `korean_hangul` VARCHAR,
    `pinyin` VARCHAR,
    `vietnamese` VARCHAR,
    `kangxi` INTEGER,
    `position` INTEGER,
    `important` BOOLEAN,
    PRIMARY KEY (`code`)
);
```

```sql
CREATE TABLE `kanji_radical_link` (
    `kanji_code` INTEGER,
    `radical_code` INTEGER,
    `occurrences` INTEGER
);
```

```sql
CREATE TABLE `kana` (
    `code` INTEGER,
    `reading` VARCHAR,
    `example` VARCHAR,
    `meaning` VARCHAR,
    `translation` VARCHAR,
    `origin` VARCHAR,
    `is_katakana` BOOLEAN,
    `is_archaic` BOOLEAN,
    `is_diacritic` BOOLEAN,
    `stroke_count` INTEGER,
    `stroke_paths` VARCHAR,
    `sequence` INTEGER,
    PRIMARY KEY (`code`)
);
```

```sql
CREATE TABLE `dict_entry` (
    `id` INTEGER,
    `entry` VARCHAR,
    `entry_template` VARCHAR,
    `readings` VARCHAR,
    `meanings` VARCHAR,
    `meanings_template` VARCHAR,
    `translation` VARCHAR,
    `notes` VARCHAR,
    `tags` VARCHAR,
    `audio` VARCHAR,
    `is_usually_kana` BOOLEAN,
    `exercise_count` INTEGER,
    `jlpt_level` INTEGER,
    `sentence_count` INTEGER,
    `is_common` BOOLEAN,
    PRIMARY KEY (`id`)
);
```

```sql
CREATE TABLE `dict_entry_kanji` (
    `entry_id` INTEGER,
    `kanji_code` INTEGER,
    `kanji_reading` VARCHAR,
    `variant_reading` VARCHAR,
    `reading_type` INTEGER,
    `is_headword_kanji` BOOLEAN,
    `is_recommended` BOOLEAN,
    `is_example_reading` BOOLEAN
);
```

```sql
CREATE TABLE `dict_entry_reference` (
    `entry_id` INTEGER,
    `entry_ref_id` INTEGER,
    `position` INTEGER
);
```

```sql
CREATE TABLE `name` (
    `id` INTEGER,
    `name` VARCHAR,
    `reading` VARCHAR,
    `type` VARCHAR,
    PRIMARY KEY (`id`)
);
```

```sql
CREATE TABLE `name_kanji_link` (
    `kanji_code` INTEGER,
    `example_name_id` INTEGER
);
```

```sql
CREATE TABLE `sentence` (
    `id` INTEGER,
    `text` VARCHAR,
    `translation` VARCHAR,
    PRIMARY KEY (`id`)
);
```

```sql
CREATE TABLE `sentence_link` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `sentence_id` INTEGER,
    `kanji_code` INTEGER,
    `recommended` BOOLEAN
);
```

```sql
CREATE TABLE `sentence_vocab_link` (
    `sentence_id` INTEGER,
    `vocab_id` INTEGER,
    `start_index` INTEGER,
    `length` INTEGER
);
```

```sql
CREATE TABLE `analytics` (
    `code` INTEGER,
    `is_radical` BOOLEAN,
    `quiz_count` INTEGER,
    `quiz_accuracy` FLOAT,
    `quiz_duration` INTEGER,
    `writing_count` INTEGER,
    `writing_accuracy` FLOAT,
    `writing_mistakes` FLOAT
);
```

```sql
CREATE TABLE `quiz_mistake` (
    `code` INTEGER,
    `is_radical` BOOLEAN,
    `answer_code` INTEGER,
    `answer_count` INTEGER,
    `percentage` FLOAT,
    `duration` INTEGER
);
```

```sql
CREATE TABLE `draw_mistake` (
    `code` INTEGER,
    `is_radical` BOOLEAN,
    `ordinal` INTEGER,
    `count` INTEGER,
    `avg_mistakes` FLOAT
);
```

```sql
CREATE TABLE sqlite_sequence(name,seq);
```

The statistics describe this file only. Recompute counts and rerun the relationship checks after replacing it with another database snapshot.
