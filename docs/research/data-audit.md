# Data Audit and Offline Packaging

Date: 2026-10-07. Status: source inspection complete; runtime contract pending architecture review.

## Evidence and Scope

The audit read `Resource/kanji_database.md` and opened `Resource/kanji.db` with SQLite `mode=ro`. `PRAGMA integrity_check` returned `ok`. SHA-256 was independently verified as `f0ab73a3a8d425455f93647c4305b76185d8156592df0cf534bbf4f7674ce4e6`. The source remains unchanged.

| Catalog | Records | Relevant limitations |
| --- | ---: | --- |
| Kanji | 7,045 | 628 lack stroke paths; 157 lack English meaning; 9 code points exceed U+FFFF |
| Kana | 148 | 74 per script, including dataset-designated archaic forms |
| Radicals | 265 | Component links include 1,629 other component codes |
| Vocabulary | 214,894 | 40,749 have no written-form string; readings still exist |
| Names | 87,950 | IDs and spellings are not interchangeable |
| Sentences | 16,277 | Annotated text requires parsing; 2 have no vocabulary links |
| Audio references | 8,132 | References only; files are external to the database |

The three aggregate tables (`analytics`, `quiz_mistake`, `draw_mistake`) contain neither user identities nor timestamps. They must not initialize personal progress. Build a derived catalog excluding them, and store new progress in a separate user database. Their scores and durations are not authoritative grading algorithms.

## Encodings and Rendering Rules

### Identity, Readings, and Study Lists

Use `{ domain: 'kanji' | 'kana' | 'radical', code: number }` for characters. A radical and a kanji may share a code point. JavaScript must use `String.fromCodePoint` and code-point iteration. Vocabulary, name, and sentence IDs are opaque integers with gaps.

On/kun readings split on commas. Preserve `!` and `*` metadata separately from visible readings; their precise semantics require reference-application evidence. A period separates stem from okurigana (`まな.ぶ`). Alternative forms use `k` or `s` followed by comma-separated glyphs; `弁 → k辨,瓣,辯` disproves a single-target assumption.

All 12 ordering systems have complete 1–7,045 permutations: `jlpt`, `jlpt_revised`, `jouyou`, `jouyou_revised`, `heisig`, `heisig_revised`, `kanken`, `kanken_revised`, `kklc`, `freq`, `hadamitzky`, `kic`. Level 0 means the unclassified tail, not study-list membership. Default ordering equals `jouyou`. Revised Jōyō grades 1–6 contain 1,026 records; default grades contain 1,006. UI labels for Kanken and textbook chapter codes need application evidence.

### Paths and Components

Every populated stroke field splits on `|` into exactly its declared stroke count: 79,035 kanji strokes, 1,472 radical strokes, 437 kana strokes. Values are SVG path data, never HTML; bind them to SVG `d` attributes. Preserve order. Missing paths require a visible glyph fallback and exclusion from automated stroke judging.

Component fields follow examples such as `!囗0,1,7|玉2-6|王2-5|丶6`. A colon denotes separate occurrences: `三` has `!一0:1:2`, and `串` has `口0-2:3-5|!丨6`. Ranges are inclusive and zero-based. Components overlap. `!`/`*` flags require interpretation separately. Decomposition strings may contain nested braces and supplementary/private-use glyphs; they are not simple lists of catalog keys. Left joins must retain components absent from the radical catalog.

### Vocabulary

- `entry`: `|`-separated written forms. An empty field is valid.
- `readings`: exactly one `;`, dividing Japanese comma-separated readings from romanized comma-separated search terms.
- `entry_template`: written-form references `[n]` are one-based. A colon introduces reading variants; spaces divide furigana segments. Leading numbers can span multiple written characters (`[2]:2あく どい` for 灰汁どい). Comma suffixes contain lexical flags and numeric pitch metadata. Both `;` and `|` divide form groups, with distinct prominence inferred from the reference UI; preserve both in the parser.
- `meanings`: `|`-separated gloss segments; commas are part of the gloss, not sense boundaries.
- `meanings_template`: replace `[n]` with its gloss while retaining parenthesized sense labels, references, usage notes, and braced domain labels such as `{food}`. Render as text nodes, never interpolated HTML.
- `tags`: whitespace-separated lexical/domain tokens and `p`, `c`, `k` numeric tokens. Every `pN` set exactly matches numeric suffixes in its entry template across all 214,894 rows, consistent with pitch-accent metadata. `c`/`k` resemble displayed character/kanji counts but must not be labeled without UI confirmation. Preserve unknown tags rather than dropping them.
- `audio`: `resourceId|Japanese label`. No URL is encoded. Each resource ID matches a licensed Kanji alive MP3 filename (see below).
- `dict_entry_kanji`: preserve all reading associations. Duplicate `(entry_id, kanji_code)` pairs have distinct reading metadata; use `DISTINCT` only for lists of vocabulary entities.
- `dict_entry_reference.position`: do not apply blindly to rendered text; 19 offsets exceed the raw template length. Related-entry links can remain separately navigable until a complete offset convention is established.

Representative parser fixtures: IDs 1000000 (empty written form), 1000090 (five glosses), 1000260 (multi-character reading), 1000320 (many readings), 1000620 (multiple pitches), 1160820 (一つ variants), 1206730 (学校).

### Sentences

`{reading}` annotates the next glyph; `{2reading}` and `{3reading}` annotate two/three glyphs. Counts: 79,814 single-glyph annotations, 901 two-glyph, and 8 three-glyph. U+3000 separates tokens. Parse to ruby/plain segments and a plain text string without annotations or separators. Example: `リンゴ　を　もう　{ひと}一つ` becomes `リンゴをもう一つ` with ruby over 一.

Vocabulary spans refer to normalized plain text. All 63,502 fit those bounds, but sentence 9163 has a zero-length span. Linked sentences contain no supplementary characters, so the source cannot establish whether historical offsets meant UTF-16 units or Unicode code points. Use explicit code-point span semantics internally and validate at import.

## Audio Availability

The [official Kanji alive repository](https://github.com/kanjialive/kanji-data-media) and its [audio README](https://github.com/kanjialive/kanji-data-media/blob/master/examples-audio/README.md) publish the [MP3 archive](https://media.kanjialive.com/examples_audio/audio-mp3.zip). The archive observed on 2026-10-07 is 130,417,315 bytes. Its ZIP directory contains every one of the database's 8,132 unique resource IDs, with **zero missing matches**. The selected MP3 files total 111,017,452 bytes (105.87 MiB). Example: `mana(bu)_06_h` maps to `audio-mp3/mana(bu)_06_h.mp3`.

Build-time downloads succeeded with a browser User-Agent and the official app Referer (`https://app.kanjialive.com/`); bare Python HEAD requests returned 403. Download/extract only at build time, retain source and digest provenance, and serve the audio from the same origin. Runtime must not depend on Kanji alive hosting or an API key. Local speech synthesis can supplement unsupported entries but cannot substitute for the verified offline recordings.

## Offline Architecture Recommendation

1. Deterministically derive a read-only SQLite catalog, excluding source aggregate statistics and empty customization slots where appropriate. Never mutate the source. Keep full catalog coverage and relationships.
2. Run SQLite WASM queries in a dedicated worker behind typed repository methods. A simple `sql.js` in-memory catalog is broadly compatible but must be measured on mobile for peak memory; OPFS SQLite is the upgrade path if that budget fails. Official SQLite [persistence documentation](https://sqlite.org/wasm/doc/trunk/persistence.md) describes VFS/browser/concurrency tradeoffs.
3. Bundle all runtime scripts, WASM, fonts, app icons, manifest, catalog, and licensed audio at the same origin. The Docker image serves static files; no application backend is needed.
4. Pack audio into bounded binary shards plus resource ID → shard/offset/length metadata. This avoids thousands of requests and permits `Blob.slice` playback without decoding every recording. Verify each immutable asset with SHA-256 before marking installation complete.
5. Keep install state (`pending`, `ready`, `failed`) separate from active catalog version. Resume downloads by validated shard; an interrupted update leaves the previous installed version usable. Only advertise “Ready offline” after app shell, catalog, and all required audio pass verification.
6. Keep user progress, notes, settings, bookmarks, sets, and review events in IndexedDB with a versioned export/import schema. Catalog replacement cannot reset progress. Atomic transactions must protect quiz/session completion.
7. Request persistent storage and surface quota/download errors in initialization. Browser storage may be evicted; export and restore are essential. [WebKit's storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) explicitly supports persistence requests and Home Screen app heuristics but does not guarantee all writes succeed.

A raw JSON-array export of all 15 catalog tables was measured at approximately 82.5 MB uncompressed and 22.8 MB gzipped; object exports expand substantially in memory. These are alternatives for transport benchmarking, not a reason to instantiate the entire catalog as UI objects.

Minimal repository surface: catalog status/install progress; character list/filter and detail; vocabulary search/detail; related vocabulary/names/sentences; sentence search/detail; list-system metadata; component lookup; and offline audio blobs. All list methods need pagination and deterministic ordering. Queries must use parameters and allowlisted sort columns.

## Licensing and Attribution

The Android reference app credits WWWJDIC (CC BY-SA 4.0), KanjiVG (CC BY-SA 3.0), Tatoeba (CC BY 2.0), Tanos (CC BY 2.0), Kanji alive word audio (CC BY 4.0), and BabelStone. It describes Remembering the Kanji and Kanji in Context material as added with permission. This is evidence of the original app's attribution, not proof that every permission transfers to this project.

Current primary sources confirm [EDRDG's dictionary terms](https://www.edrdg.org/edrdg/licence.html), [KanjiVG's licence](https://kanjivg.tagaini.net/), and [Kanji alive's CC BY 4.0 media licence](https://github.com/kanjialive/kanji-data-media/blob/master/LICENSE.md). Kanji alive excludes mnemonic hints and textbook lesson data from its public distribution. The supplied SQLite snapshot has no source version or attribution table. Preserve an explicit provenance record and do not relabel third-party data as LGPL. Original application code can use LGPL while data retains its own terms. Package acknowledgments and licence links/files in an offline-accessible Sources screen. Confirm any separately permissioned textbook material before public redistribution.

## Acceptance Tests

- Source hash/integrity remain unchanged; generated catalog has every expected content count and no original aggregate tables.
- Every declared relationship resolves except documented component/variant exceptions; every sequence remains a permutation with an unclassified tail.
- Parser corpus covers markers, empty forms, grouped readings, multiple pitches, gloss placeholders, sentence ruby, supplementary glyphs, and zero-length spans.
- List/search tests cover kana/romaji/English, character/stroke/level/component filters, deduplication, ordering, and pagination.
- Every audio ID resolves to an in-bounds MP3 slice; all shard digests match; at least representative files decode in Chromium and WebKit.
- Fresh-install, interrupted-install resume, corrupt shard, insufficient storage, catalog update, and cold offline reload exercise real storage/service worker behavior.
- New user progress starts empty, remains isolated from source aggregates, survives catalog update/reload, and round-trips through export/import.
