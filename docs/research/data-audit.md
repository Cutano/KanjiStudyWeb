# Data Audit and Offline Packaging

Date: 2026-10-07. Status: source inspection and data runtime verified; physical iOS/Android device qualification remains separate.

## Evidence and Scope

The audit read `Resource/kanji_database.md` and opened `Resource/kanji.db` with SQLite `mode=ro`. `PRAGMA integrity_check` returned `ok`. SHA-256 was independently verified as `f0ab73a3a8d425455f93647c4305b76185d8156592df0cf534bbf4f7674ce4e6`. The source remains unchanged.

| Catalog          | Records | Relevant limitations                                                         |
| ---------------- | ------: | ---------------------------------------------------------------------------- |
| Kanji            |   7,045 | 628 lack stroke paths; 157 lack English meaning; 9 code points exceed U+FFFF |
| Kana             |     148 | 74 per script, including dataset-designated archaic forms                    |
| Radicals         |     265 | Component links include 1,629 other component codes                          |
| Vocabulary       | 214,894 | 40,749 have no written-form string; readings still exist                     |
| Names            |  87,950 | IDs and spellings are not interchangeable                                    |
| Sentences        |  16,277 | Annotated text requires parsing; 2 have no vocabulary links                  |
| Audio references |   8,132 | References only; files are external to the database                          |

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

## Implementation Verification

### Dictionary and Sentence Follow-up

Native search observation and the source `search_sort_idx(jlpt_level, sentence_count, is_common)` establish the ranking dimensions. Literal 学 places its exact N3 entry before N5 compounds; an English `school` query places all observed N5 matches before N4 教育 despite 教育 having more examples than some N5 entries. The implementation therefore orders exact written-form/reading matches first, then JLPT N5 through N1 and unclassified, then the number of distinct available linked sentences, then the common-word flag. Reading text and entry ID provide a deterministic tie-break; the native tie-break is not established. There is no prefix bonus or fabricated numerical word-frequency rank.

Native resources identify the number badge as the combined count of Graded Reading exercises and ordinary example sentences. The supplied snapshot has no populated cached count and excludes the locked extension corpus, so the Web query derives counts from `sentence_vocab_link`. For example, 学校 has 73 supplied sentences, 今日 96, and 漢字 7. Exact native ranking within a JLPT tier can differ when unavailable extension counts would change that order. Numeric `pN` tokens are pitch metadata; `cN`/`kN` are not used as frequency or importance.

Sense parsing follows the template's sequential numbered boundaries and inherits part-of-speech groups until another group is specified. It retains ordered inline content, including gloss slots, notes, usage/field tags, cross-references, and their separators. Raw gloss-slot boundaries are not independent paragraphs: 3,218 entries contain adjacent slots around a parenthetical annotation. For example, お呪い (1001490) must retain “code that is not (yet) necessary to understand” in one sense; 1014440 retains “Ivy League (clothing) style”. 生 (1378450) contains 12 numbered senses but 14 gloss slots; 上 (1352130) has 12 senses and 15 slots. Parenthesized dates such as `(1995)` remain notes. A corpus test confirms that all 214,894 entries preserve every gloss in both the provenance fields and ordered display content. Known compact tags receive readable labels; unknown tags/notes are retained. This structure follows [EDRDG's documented sense and priority fields](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html); entry IDs are not frequency ranks.

Each written form now retains its individual reading variants and their own pitch values and flags. 今日's きょう and こんにち both have accent 1, while its separately encoded こんち and こんじつ readings have no supplied accent; none inherits another reading's accent. The first template form supplies the preferred display spelling, including kana-first こんにちは. Pitch diagrams use the supplied lexical accent and mora boundaries with a following unaccented particle, distinguishing unaccented 0 from final-mora accent. The model follows the [University of Tokyo/OJAD workshop](https://www.gavo.t.u-tokyo.ac.jp/~mine/japanese/CMP/OJAD_Kashiwa2018W.pdf) and [TUFS mora guide](https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/01-10-01.php). It does not predict sentence intonation or invent absent pitch values.

`getSentenceDetail` exposes linked characters and vocabulary with Unicode code-point spans in `plainSentence(text)`, after annotations and U+3000 separators are removed. The source's zero-length span remains explicit with empty surface text and must not be highlighted. Sentence 1 resolves リンゴ, もう, 一つ, and いかが to their vocabulary IDs; entries without vocabulary links remain readable. Sentence notes use the existing profile `sentence:<id>` key convention.

- Follow-up verification: `npx vitest run src/data` passed 30 tests, including complete gloss preservation, inline annotation order, representative POS inheritance, per-reading pitch, mora patterns, native-priority ordering, and sentence span/link edge cases. Strict TypeScript and `git diff --check` passed. Production UI acceptance is recorded by the application workstream after its build.

- `npm run data:prepare` generated all catalog entities and 8,132 recordings in nine immutable assets totaling 142.4 MiB. Repeating the command with the same local toolchain produced the same manifest version, `9ab7b1f2087fbe502ed7`. Audio archive SHA-256: `c9cf970981c5d8c3f05bc9216c3b36a644a8be389183fb5b667b233028ec5aa4`.
- Compressed catalog bytes deliberately use a `.sqlite.bin` extension. Vite applies `Content-Encoding: gzip` to `.gz` files, which makes Fetch decode the bytes before application digest verification; opaque binary transport avoids that mismatch.
- `npx vitest run src/data` exercises the full source catalog and assets plus installation transactions. The suite covers sequence permutations, Unicode and missing paths, compound filters, vocabulary relationships, the entire sentence parser corpus, every audio slice and digest, corrupt-download retry, failed-update rollback, offline initialization, cancellation, and profile-preserving removal.
- Actual Playwright Chromium and WebKit engines initialized the complete catalog and recordings, queried 学 and 学校, and decoded the native 学校 MP3 (approximately 1.05 seconds). This is engine testing on macOS, not a claim of physical iPhone or Android installation/memory testing.
- A browser cancellation check stopped after the catalog file, resumed from that verified asset, then removed the reference library while preserving an unrelated user database.
- Production acceptance passes in Chromium desktop and WebKit mobile: complete catalog counts, stroke/ruby details, native audio decoding, favorite and backup restoration, cold offline opening, corrupted asset rejection, and cancellation/resume without re-downloading verified files. WebKit offline verification shuts down a real isolated origin because the automation engine's synthetic offline switch fails before service-worker dispatch. Corruption and delayed-response tests also use the actual static origin, avoiding service-worker routing limitations.
- Search accepts unions within requested JLPT or stroke-count values, intersections across different dimensions and text terms, exclusions, meaning phrases, kana-script equivalence, and vocabulary common/audio/POS filters. Tests verify these rules against the complete derived SQLite catalog.
- Final production data acceptance on 2026-10-07: `npx playwright test tests/e2e/offline-catalog.spec.ts tests/e2e/extensions.spec.ts --output=.cache/e2e-data-final` passed **8/8 cases in 31.0 seconds**, across Chromium desktop and WebKit mobile. Both engines decoded the native 学校 recording after a cold offline page load. The extension journey imported original user-authored content while the origin was unavailable, verified provenance/export and invalid replacement rollback, displayed readings/explanations, and restored the extension plus read tracking after profile reset and backup import.
- Additional metadata mappings preserve Korean romanization, kana source flags, radical variant bases, and mixed Kangxi ordinal/base-code values. Component navigation resolves an actual radical or kanji identity and leaves uncataloged components unlinked. A regression test serializes catalog update completion before reference deletion, protecting against in-flight noncancelable storage writes.

## Reproducible release environment

The digest-pinned Docker toolchain is the canonical byte-reproducible release environment. A local Node 24 build can bundle a different SQLite release. The final Mac and Docker catalogs have identical content after the 100-byte SQLite file header; the only uncompressed differences are two bytes within SQLite's offset 96–99 writer-version field (Mac 3.51.2, Docker 3.53.4). Gzip also records the originating OS. These are legitimate provenance differences, not dictionary differences, and each manifest correctly hashes its own artifacts. Do not erase the writer version to disguise an environment change. See the [SQLite file format specification](https://sqlite.org/fileformat.html#write_library_version_number_and_version_valid_for_number).

For this release, the local browser-test catalog version is `9ab7b1f2087fbe502ed7`; the Docker catalog version is `18993e9136e118e785b8`. Both contain the same records and all 8,132 audio references. Byte equality of SQLite content after its header was verified with SHA-256 `82e8d19da0c3566361c229b1304088f9863efd17f2009d71aa10275f1f23ee6f`.
