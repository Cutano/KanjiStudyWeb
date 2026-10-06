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

Writing's entry point explicitly advertises stroke detection and self-check. Ordered source stroke paths are present for all kana/radicals and most kanji. The intended independent Web implementation should support guided tracing, recognition against ordered geometric paths, and honest self-assessment when no paths exist. It must not describe glyph display or a free drawing pad alone as stroke detection.

### Search and dictionaries — dataset plus app entry points

The app exposes search for kanji and words, favorites, and character information. The database supports textual lookup across meanings/readings, stroke count, component intersection, multiple kanji classification systems, vocabulary, proper names, and linked example sentences. Search detail behavior beyond the inspected entry points must be verified in browser acceptance tests rather than labeled pixel-identical Android behavior.

Character data includes ordered SVG stroke paths; components/decomposition; readings; meanings; related vocabulary, sentences, and proper names; other-language readings; name readings; alternate forms; kokuji and phantom flags. Vocabulary includes multiple readings/senses, tags, commonness, level, references, annotations, and audio identifiers. New user notes, favorites, overrides, and study ratings belong to a separate profile.

## Settings inventory — observed

| Category | Visible purpose |
| --- | --- |
| Study options | Show romaji, simplify meanings, quiz timer |
| Display | Character font, rotation, accessibility |
| Guided Study | Workload, quiz configuration, ready notifications |
| Notifications | Daily target, study reminders, campaign |
| Audio | Native audio, bulk download, text-to-speech |
| Localization | Translations, volunteers, additional readings |
| Backup and restore | Online backup, local import and export |
| Troubleshooting | Search history, tutorial reset, progress reset |
| Support | Restore purchases, FAQ, developer contact, donations |
| About | Release notes, app summary, linking, credits, analytics, privacy, builds |

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

| Source | License/permission text shown |
| --- | --- |
| Jim Breen's WWWJDIC | Creative Commons Attribution-ShareAlike 4.0 |
| KanjiVG | Creative Commons Attribution-ShareAlike 3.0 |
| UniDic | Modified BSD |
| Tatoeba | Creative Commons Attribution 2.0 |
| Tanos | Creative Commons Attribution 2.0 |
| Kanji alive (word audio) | Creative Commons Attribution 4.0 |
| BabelStone IDS, Andrew West | Free to use, without permission |
| Remembering the Kanji | Added with permission |
| Kanji Learner's Course | Added with permission |
| Kanji in Context | Added with permission |
| Frequency lists, Dmitry Shpika | Creative Commons Attribution 4.0 |
| Wikipedia | Creative Commons Attribution 3.0 |

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
