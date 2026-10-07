# Android Reference Research

## Reference and method

- Research date: 2026-10-07, Asia/Shanghai.
- Device: the user-provided running Android emulator `emulator-5554`, Google `sdk_gphone16k_arm64`.
- Package: `com.mindtwisted.kanjistudy`.
- Installed version: **7.8.2**, version code **70802**, build shown as `U33:C41:O14:G14:S5`, September 24, 2026.
- About screen: Edict/Kanjidic build September 12, 2026; Outlier build 1.10.1, July 12, 2026.
- Method: ADB UI navigation, `uiautomator` accessibility dumps, screenshots, package metadata, and read-only APK asset inventory. No purchase controls were bypassed. No reference application code was copied or decompiled.
- Evidence: numbered XML captures in `docs/research/captures/`. These are accessibility snapshots, not a complete inventory of custom-drawn controls. Sample screenshots are supplemental.
- Interaction caveat: opening flashcard study automatically recorded roughly 40 seconds of study time. No quizzes were answered and no learning ratings, purchases, or progress resets were performed during baseline research.

## Evidence labels

**Observed** means directly inspected in the installed application. **Dataset** means supported by the supplied SQLite file/reference. **Inferred** means a proposed interoperable Web behavior, not a claim about exact Android internals. **Unavailable** means the research environment could not expose or reproduce the feature without additional access or resources.

## Product structure

### Home and navigation — observed

The home dashboard has beginner guidance and links to kana charts and beginner kanji. Guided Study shows a mascot, level/XP, five mastery buckets (0–24%, 25–49%, 50–74%, 75–99%, 100%), a seven-day review forecast, settings, a new-kanji start action, and quick-review options. The initial state offers five new kanji at level 1-1, with 100 XP to the next level. The Graded Reading Sets card shows selected level and percent read. A floating search action is present.

The drawer includes seen/familiar/known counts, total study time, days studied, Search, Favorites, Rankings, Kana, Radicals, Custom sets, the current sequence's kanji levels, sequence choice, theme, settings, Guided Study, Graded Reading Sets, Outlier, and purchase options.

The default school levels are Elementary 1–6, Secondary 1–3, Advanced, and Other. The inspected app shows 80, 160, 200, 200, 185, 181, 316, 285, 333, 196, and 4,935 characters respectively. These installed-version counts differ from the older supplied catalog and must not be represented as its counts.

### Ordering systems — observed and dataset

The installed app offers Japanese School Grades; JLPT; Kanji Learner's Course; Jouyou 2020; revised JLPT; media frequency; media frequency 2023; Kanken; Kanken 2020; Remembering the Kanji editions 1–5 and edition 6; Kanji in Context; Hadamitzky/Spahn; and custom sequence from a set, clipboard, or imported text.

The supplied database has twelve named sequence pairs. It does **not** contain a separate 2023 frequency sequence. Use stored systems and exact source ordering; do not synthesize an official missing list.

### Level lists and sets — observed

Elementary 1 is split into eight sets of ten characters. Each row has a study action, and a footer can study the whole level. A tutorial explicitly says users can merge and split sets. Opening a set shows characters, their sequence number, on/kun readings, and meanings. The toolbar supports selection and view-mode switching. Menu options include sorting and screen customization. Study time and last-studied date appear on set rows after study.

Custom-set creation is gated behind the Android upgrade in this installation. The Web product can independently implement local editable sets against its supplied catalog; it should not pretend a paid Android export format has been reverse-engineered.

### Study modes — observed

The study chooser offers:

1. Flashcard study — character memorization.
2. Multiple choice quizzes — quick knowledge check.
3. Writing challenges — stroke detection and self-check.
4. Learn by reading — graded reading exercises, marked demo in this installation.

Flashcards swipe or use previous/next controls; tapping reveals character details. Cards can be assigned study ratings and filtered by rating. The inspected card front showed a glyph and vocabulary examples; its back added readings and meaning. Position and set size are visible. Toolbar actions switch sets and customize the screen/theme.

The multiple-choice setup displays last studied, quizzes, and accuracy. Observed prompt types are Info → Kanji, Kanji → Meaning, Kanji → Readings, and Example → Kanji. Content toggles include on-readings, kun-readings, additional Asian readings, meanings, and custom notes. Session options include repeating incorrect items, pause-after-answer policy, quiz ordering (initially least seen), full meanings, automatic reading audio, hiding answers until a tap, no timeouts, and disappearing-answer challenge mode. The tutorial states that timers and distractors adapt to performance. Exact adaptive formulas were not exposed.

Further observed writing setup distinguishes automatic stroke detection, manual stroke detection, and manual self-check. Prompts can use character information or random examples. Session settings include detection strictness, hints after consecutive mistakes, repeat-until-perfect, automatic reading audio, a character-shadow practice aid, and disappearing-answer challenge mode. The tutorial describes correct stroke order and a flower-mark grade after attempts. Exact recognition tolerances and grading formulas are not exposed.

Writing's entry point explicitly advertises stroke detection and self-check. Ordered source stroke paths are present for all kana/radicals and most kanji. The intended independent Web implementation should support guided tracing, recognition against ordered geometric paths, and honest self-assessment when no paths exist. It must not describe glyph display or a free drawing pad alone as stroke detection.

### Search and dictionaries — observed and dataset

The app exposes search for kanji and words, favorites, and character information. The database supports textual lookup across meanings/readings, stroke count, component intersection, multiple kanji classification systems, vocabulary, proper names, and linked example sentences. The search screen has Words and Kanji tabs with result counts, select-all, clipboard paste, and contextual filter controls. The app recommends the external GBoard handwriting keyboard for search-by-drawing; no built-in search recognizer was observed.

Observed word-search criteria: multiple kanji tokens (intersection), kana/romaji reading prefixes, English meanings, quoted meanings that exclude romaji, JLPT `n1`–`n5`, minimum known-kanji ratings `1*`/`2*`/`3*`, exact unique-kanji count, `-cN` total character count, `-c` commonness, `-f` favorites, and `-a` native audio. Dialect, field, part-of-speech, miscellaneous, and reading/kanji-information filter pickers are present. Supported criteria can use double-dash exclusion.

Observed kanji search criteria: readings/meanings, direct glyphs, multiple radicals including duplicate occurrences, one or more stroke counts, multiple JLPT/grade levels, exact ratings `0*`–`3*`, favorites, commonness, decomposition availability, add-on availability, and ignored Guided Study items. Radical/filter pickers show remaining-result counts. A Web filter UI may express these semantics without retaining the Android query syntax.

A directly observed 水 detail page exposes favorites, study rating, custom set, stroke animation/practice, and aggregate-user mistake views. It shows grade, sequence, strokes, study time, quizzes, progress, editable meaning/readings/notes, components, and a decomposition tree. Its tutorial explicitly confirms reading examples, selected words, example sentences, and names. Global-user mistake aggregates are not a backend capability of the independent Web app; personal mistake tracking is the offline equivalent.

Character data includes ordered SVG stroke paths; components/decomposition; readings; meanings; related vocabulary, sentences, and proper names; other-language readings; name readings; alternate forms; kokuji and phantom flags. Vocabulary includes multiple readings/senses, tags, commonness, level, references, annotations, and audio identifiers. New user notes, favorites, overrides, and study ratings belong to a separate profile.

### Radical position legend — observed follow-up

Opening a radical detail and tapping **Position** displays a native legend: 偏 (へん), Left Side; 旁 (つくり), Right Side; 冠 (かんむり), Top; 脚 (あし), Bottom; 垂 (たれ), Northwest; 繞 (にょう), Southwest; 構 (かまえ), Enclosure; and No common position. These English labels were independently confirmed in the installed APK's `screen_radicals_info_*` string resources. Capture: `captures/50-radical-position-legend.xml` and `.png`.

The database's numeric mapping remains based on its representative glyphs (documented in the supplied database guide): 0 unspecified, 1 left, 2 right, 3 top, 4 bottom, 5 northwest, 6 southwest, 7 enclosure. The observed UI confirms the category meanings and legend order; it does not expose the integer enum itself. Preserve the raw category and label any inferred mapping accordingly.

## Settings inventory — observed

| Category           | Visible purpose                                                          |
| ------------------ | ------------------------------------------------------------------------ |
| Study options      | Show romaji, simplify meanings, quiz timer                               |
| Display            | Character font, rotation, accessibility                                  |
| Guided Study       | Workload, quiz configuration, ready notifications                        |
| Notifications      | Daily target, study reminders, campaign                                  |
| Audio              | Native audio, bulk download, text-to-speech                              |
| Localization       | Translations, volunteers, additional readings                            |
| Backup and restore | Online backup, local import and export                                   |
| Troubleshooting    | Search history, tutorial reset, progress reset                           |
| Support            | Restore purchases, FAQ, developer contact, donations                     |
| About              | Release notes, app summary, linking, credits, analytics, privacy, builds |

For the static Web port, local backup/restore and durable offline storage replace backend-dependent cloud backup. Browser settings and OS controls govern home-screen installation, audio voices, rotation, and notification support.

## Audio — observed

Audio settings state that native word audio is downloaded and cached the first time it is played; a separate action downloads all files. Disabling downloadable audio removes native-play icons and can fall back to enabled TTS. Android TTS requires a Japanese voice installed in the system engine.

The supplied database stores audio references but no audio bytes. Read-only APK inventory found kana MP3 files under `assets/sounds`, `assets/audio1.dat`, `audio2.dat`, `audio.jp1.dat`, and `audio.jp2.dat`. Their presence does not establish the format, completeness, or redistributability of the packs. Source audio and exact mappings need a separate audited asset pipeline. System speech synthesis is optional convenience and cannot alone substantiate fully offline native-audio parity.

## Paid extensions and revised scope

The user clarified that completion targets **all core functionality**, with later extension import. Full locked KLC and Outlier content is therefore outside the current completion gate; the implementation must expose a documented extension-pack path and must not invent those texts.

- **KLC Graded Reading Sets:** installed screen describes 30,000+ exercises, phonetic guides, English translations, optional word division, dictionary links, and grammar support for 600+ sentence structures. Available within dedicated reading, detail screens, and quizzes. First 100 kanji are free.
- **Outlier Essentials:** over 100 free entries; the purchase screen offers another 2,983 entries.
- **Outlier Expert:** over 50 free entries; the purchase screen offers another 329 entries and labels it early access.
- Both Outlier editions display a purchase price in this installation. We did not unlock them.
- APK inventory includes `assets/klc.db.zip` and `assets/outlier.db.zip`. These locked assets were not extracted for the application, and their inclusion in an APK is not a license grant.
- The app separately requires its upgrade to unlock every manual-study level and custom-set creation. Purchases are Android storefront behavior and are not part of the independent LGPL Web product.

## Credits and provenance — observed, not a license audit

The Android Development Credits screen gives the following source acknowledgements. These are evidence for follow-up attribution, not a definitive license opinion on every field in the supplied snapshot.

| Source                         | License/permission text shown               |
| ------------------------------ | ------------------------------------------- |
| Jim Breen's WWWJDIC            | Creative Commons Attribution-ShareAlike 4.0 |
| KanjiVG                        | Creative Commons Attribution-ShareAlike 3.0 |
| UniDic                         | Modified BSD                                |
| Tatoeba                        | Creative Commons Attribution 2.0            |
| Tanos                          | Creative Commons Attribution 2.0            |
| Kanji alive (word audio)       | Creative Commons Attribution 4.0            |
| BabelStone IDS, Andrew West    | Free to use, without permission             |
| Remembering the Kanji          | Added with permission                       |
| Kanji Learner's Course         | Added with permission                       |
| Kanji in Context               | Added with permission                       |
| Frequency lists, Dmitry Shpika | Creative Commons Attribution 4.0            |
| Wikipedia                      | Creative Commons Attribution 3.0            |

Project code uses LGPL-3.0-or-later as requested. Content licenses and acknowledgements remain separate. The original application's brand artwork, mascot, paid explanatory texts, and UI assets are not necessary to reproduce core workflows.

## Catalog limits that affect parity

See `Resource/kanji_database.md` for detailed counts and encodings. Important implications:

- Supplied catalog: 7,045 kanji, 148 kana, 265 radicals, 214,894 vocabulary entries, 87,950 names, 16,277 sentences.
- The original supplied analytics/mistakes are preexisting user data, not neutral reference content. Exclude them from the derived catalog and new profile.
- 628 kanji lack stroke paths. Every missing-path feature needs an explicit alternate behavior.
- Component relations include forms absent from the radical/kanji catalogs, including private-use glyphs. Preserve identity and explain unavailable labels.
- Most additional-language translations are absent; English glosses are populated. Do not manufacture localized dictionary translations.
- Example annotations, sentence UTF-16 offsets, variation readings, and vocabulary sense templates need parsers and tests.
- Exact Android SRS, timers, geometry tolerance, and purchase/backup formats are not supplied. Implement and document independently testable Web behavior.

## Dictionary follow-up — 2026-10-07

This follow-up compares the installed reference app's dictionary UI with the user's reported Web discrepancies. It used ordinary search, detail navigation, copy-entry, and inspection of installed APK string resources. No ratings, study answers, translations, notes, or other progress fields were edited. Captures 60–71 are local research evidence under `captures/` and are ignored by Git.

### Search ordering: directly observed priorities

The following are **visible result orders**, not guesses from dictionary IDs or meanings. `C` is the common-word badge, `—` means no badge was displayed, and the final column is the native sentence-count badge.

Literal **今日** displayed `WORDS (25)` and began:

| Order | Displayed entry                       | JLPT                       | Common | Native count |
| ----- | ------------------------------------- | -------------------------- | ------ | ------------ |
| 1     | 今日 (きょう / こんにち)              | N5                         | C      | 177          |
| 2     | こんにちは、今日は                    | N3                         | C      | 5            |
| 3     | 今日中に                              | —                          | —      | 1            |
| 4     | 今日この頃 (other form: 今日このごろ) | —                          | C      | —            |
| 5     | 今日的                                | —                          | C      | —            |
| 6     | 今日中                                | —                          | —      | —            |
| 7     | 今日あって明日ない身                  | Below the initial viewport |        |              |

Literal **学** displayed `WORDS (1000+)` and began:

| Order | Entry  | JLPT | Native count |
| ----- | ------ | ---- | ------------ |
| 1     | 学     | N3   | 18           |
| 2     | 学校   | N5   | 162          |
| 3     | 学生   | N5   | 138          |
| 4     | 大学   | N5   | 112          |
| 5     | 留学生 | N5   | 6            |
| 6     | 科学   | N4   | 71           |
| 7     | 数学   | N4   | 33           |

All seven had the common badge. The N3 exact entry precedes N5 compounds, so **exact matching has priority over JLPT**. The N5 examples then precede N4 entries despite lower counts, so **JLPT precedes sentence count** within the remaining matches.

The ASCII query **school** independently confirmed that second priority: 学校 N5/162, 生徒 N5/84, 門 N5/44, 授業 N5/22, 教室 N5/20, then 教育 N4/78 and 高校 N4/29. In particular, N5/20 precedes N4/78.

Literal **漢字** displayed `WORDS (49)` and began: 漢字 (C, N5, 32), 常用漢字 (C, no count), 日本漢字能力検定, 漢字Ｔａｌｋ, 漢字源, 日本漢字能力検定協会, 常用漢字表, 和製漢字. The later entries had no visible JLPT, common, or count badges.

These observations support an ordering of exact match, JLPT from N5 toward N1 followed by unclassified, sentence count descending, then commonness. The supplied schema's `search_sort_idx` on `(jlpt_level, sentence_count, is_common)` is consistent with the non-exact portion. The observations do **not** establish every tie-breaking rule, every form of exact reading normalization, or the final ordering among equal unclassified zero-count entries. Preserve a deterministic Web tie-break without calling it a verified native frequency order.

The search overflow menu exposed only **Customize screen**. Its dialog offered romaji, pitch-accent numbers, larger example text, and search-toolbar filter buttons. No user-selectable result-sort control was observed. Captures: `63-today-search`, `64-search-menu`, `65-search-customize`, `67-school-search-jlpt`, `68-gaku-search`, `69-kanji-search`.

### The count is example coverage, not general usage frequency

Two installed APK resources confirm what the numeric badge means:

- `content_description_sentence_count_tag`: “Number of sentences that contain this word.”
- `dialog_example_word_tag_sentence_count`: “Found in Graded Reading exercises (%1$d) and example sentences (%2$d)”.

Thus the count combines graded-reading associations and ordinary example sentences. It is **not** an independently supplied corpus-frequency rank. For 漢字, the displayed 32 is consistent with seven ordinary sentences plus 25 locked graded-reading exercises. 今日 displayed 96 ordinary sentences and a total badge of 177; only four graded exercises were accessible in its free subset.

The supplied database snapshot is older than the installed reference content, and its stored sentence-count values are not equivalent to the native populated values. The Web app can derive counts from its available sentence-word associations, but missing graded-reading content/counts must not be fabricated. Exact native numerical parity is not established by the observed ordering.

### Parts of speech and numbered senses

Word lists, related-word cards, and word details use the same definition hierarchy:

1. A smaller, muted blue-gray part-of-speech line.
2. One line/block per numbered sense, with green sense numbers. Comma-separated synonyms remain in the same sense.
3. A new part-of-speech line only when the inherited group changes.
4. Usage restrictions, parenthetical explanations, and cross-reference qualifiers remain inline with the relevant sense in a muted color.
5. **Other forms** and **Kanji and reading notes** are separate muted section labels; written variants can retain their own ruby.

今日 has one `Noun, Adverb` label followed by two numbered senses: `today, this day`, then `(こんにち only) these days, recently, nowadays`. The reading restriction is visually muted. Its other readings こんち and こんじつ appear under **Other forms**, and the きょう reading has a separate Gikun note.

The twelve-sense entry **上** confirms inheritance rather than one POS label per synonym or one global label:

| Sense numbers | Displayed POS group |
| ------------- | ------------------- |
| 1             | Noun, No-adjective  |
| 2–3           | Noun                |
| 4             | Noun, No-adjective  |
| 5–6           | No-adjective, Noun  |
| 7–10          | Noun                |
| 11            | Suffix              |
| 12            | Noun                |

Numbering remains continuous across these groups. The reversed POS order between senses 4 and 5 is preserved in the reference. Captures: `61-sentence-detail`, `62-today-word-detail`, `70-ue-search-senses`, `71-ue-word-detail`.

### Pitch-accent graphs

Word details place dot-and-line pitch diagrams after the written form/commonness/JLPT badges and before definitions. Each mora has a filled dot and a kana label below; an additional unlabelled hollow dot shows the pitch continuing onto the following particle. A downstep's accented mora is teal. The current native display setting hides numeric accent labels.

- **漢字 / かんじ, accent 0:** か low, ん high, じ high, followed by a hollow high dot. No accented mora is highlighted.
- **今日 / きょう, accent 1:** the combined mora きょ is high and accented, う is low, followed by a hollow low dot. Small ょ is not a separate mora.
- **今日 / こんにち, accent 1:** こ high and accented, then ん・に・ち low, followed by a hollow low dot. This is a separate reading's diagram, not another accent attached to きょう.
- **上 / うえ, accents 0 and 2:** two diagrams for the same reading. Both begin low/high; the first continues to a hollow high particle dot, while the second highlights え and drops to a hollow low particle dot.

Captures: `60-kanji-word-detail`, `62-today-word-detail`, `71-ue-word-detail`.

### Standalone sentence detail

Tapping the ordinary sentence **今日は漢字の書き取りがある。** from 漢字 opens a dedicated native page. The toolbar title preserves navigation ancestry: `今日は漢字の書き取りがある。 ‹ 漢字`.

The page contains:

- Favorite, edit translations/notes, AnkiDroid, copy, TTS, and word-division actions.
- The Japanese sentence with ruby and optional word spacing, followed by its translation. Linked lexical spans have dotted underlines.
- A collapsible **Words (3)** section listing 今日, 漢字, 書き取る in sentence order. Inflected 書き取り links to dictionary form 書き取る.
- A collapsible **Kanji (6)** section containing the sentence's constituent kanji with their readings/meanings.
- Linked word cards navigate to their own word details and preserve the sentence ancestry in the toolbar.

The parent word detail highlighted the source word 漢字 in teal inside example sentences. Capture: `61-sentence-detail`. This is an ordinary catalog example, not a paid reading text; the standalone navigation is therefore part of the core dictionary workflow.
