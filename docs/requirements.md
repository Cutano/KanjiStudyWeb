# Product Requirements

## Scope and decision record

Kanji Study Web is an independent, installable PWA implementing the core learning and reference workflows researched in `docs/research/original-app.md`. It is served as static files from Docker, has no traditional application backend, and works offline after verified initialization on supported Android and iOS browsers.

The user's clarification makes **all core features plus later extension import** the completion target. Full locked KLC and Outlier content is not a release blocker. The app must not claim to include those texts, exact proprietary algorithms, a newer unprovided dictionary snapshot, or verified real-device support without evidence.

Code is LGPL-3.0-or-later. Third-party reference data and media retain their own licenses and attribution.

## Users and principal journeys

1. A new learner opens the site, installs the PWA if desired, downloads/verifies offline resources, starts kana or a beginner kanji set, and resumes later without connectivity.
2. An intermediate learner chooses a classification system, searches by text/components/strokes, explores dictionary details, and builds custom study sets.
3. A learner practices flashcards, multiple-choice questions, writing, and reading; records self-ratings; and follows scheduled reviews and daily targets.
4. A learner exports a complete local backup, restores it on another browser, and imports compatible extension content later.

## Core feature matrix

Evidence column distinguishes direct Android observation (O), supplied data capability (D), and independently designed Web behavior (W). A row is a requirement, not a claim that it has already passed implementation tests.

| ID  | Capability             | Required outcome                                                                                                                                                                           | Evidence        |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| C01 | Offline initialization | Progress, required resource sizes, cancel/retry/error paths, durable verified readiness; no false ready state                                                                              | W               |
| C02 | Installable PWA        | Manifest, local icons/assets, responsive standalone navigation, Android/iOS instructions, safe-area layout                                                                                 | User            |
| C03 | Static deployment      | Reproducible production build, Docker image, documented HTTPS deployment; no runtime backend dependency                                                                                    | User            |
| C04 | Character library      | Complete supplied kanji, kana, radical catalogs; domain-correct identity; paging/filtering without truncation disguised as completeness                                                    | O/D             |
| C05 | Classification         | All twelve supplied sequence systems, exact stored level/order, other/unclassified group                                                                                                   | O/D             |
| C06 | Search                 | Kanji/readings/meaning text, vocabulary, strokes, component intersection, levels, favorites, ratings, commonness, and available word metadata filters; useful empty/results/history states | O/D/W           |
| C07 | Character details      | Meanings, on/kun/name/additional readings, origin/variants/flags, decomposition/components, sequence metadata                                                                              | D               |
| C08 | Stroke diagrams        | Ordered animation, replay/step controls, speed setting; clear missing-path state                                                                                                           | O/D             |
| C09 | Dictionary links       | Vocabulary details and senses, readings/ruby, tags, commonness/level, references, sentences, names, linked characters                                                                      | D               |
| C10 | Personalization        | Favorites, four study ratings, notes, editable meaning/readings, persistent user-owned overrides                                                                                           | O/D             |
| C11 | Custom sets            | Create/rename/delete, add/remove/reorder members, split/merge/import/export character collections                                                                                          | O/W             |
| C12 | Flashcards             | Front/reveal, previous/next, rating/filter/order, progress, resume, result summary                                                                                                         | O/W             |
| C13 | Multiple-choice        | Meaning, reading, character, vocabulary-context/sentence-context, kana reading, and hiragana/katakana pairing prompts; valid distractors; feedback; repeat errors; results                 | O/D/W           |
| C14 | Writing                | Pointer/touch input, ordered geometric stroke feedback, guided/test/self-check modes, hint/undo/replay, missing-path fallback                                                              | O/D/W           |
| C15 | Reading                | Annotated supplied sentences, translation reveal, linked vocabulary/characters, read tracking and repeat flow                                                                              | D/W             |
| C16 | Guided study           | New-item workload, due review queue, transparent local scheduling, persisted per-character state                                                                                           | O/W             |
| C17 | Progress               | Daily target, study days/streak/time, accuracy, mastery/rating counts, recent activity, per-character statistics                                                                           | O/W             |
| C18 | Session lifecycle      | Configurable size/order/repetition, save/resume/exit, record outcomes exactly once, meaningful completion summary                                                                          | O/W             |
| C19 | Audio                  | Locally available native audio with coverage disclosed; optional device TTS clearly labeled; no hidden runtime network requirement                                                         | O/D/W           |
| C20 | Settings               | Theme, readable font sizing, daily/session workload, furigana, audio, stroke speed, sequence; durable storage                                                                              | O/W             |
| C21 | Backup                 | Versioned full user export/import, schema validation before atomic replacement, no catalog analytics inheritance                                                                           | O/W             |
| C22 | Extensions             | Validated licensed extension pack import/export, reading and explanatory content attachment, provenance visible                                                                            | Revised scope/W |
| C23 | Storage management     | Usage/readiness state, persistent-storage request where supported, clear separation of catalog deletion and user progress reset                                                            | W               |
| C24 | Attribution            | In-app and repository notices distinguish project code, source content/media, and unavailable add-ons                                                                                      | User/O          |
| C25 | Accessibility          | Semantic controls, keyboard operation, touch targets, visible focus, contrast, screenreader labels, reduced-motion awareness                                                               | W               |

## Web adaptation boundaries

- Use a responsive sidebar/tab layout and dialogs suited to desktop and mobile; copy the learning workflow rather than proprietary visual assets.
- Local backup files replace Android online backup integrations. No account is required.
- Scheduling is a documented independent algorithm. Android's proprietary exact implementation is not claimed.
- Browser speech voices and reminders vary by OS/browser. Required reference assets are local. Never equate optional TTS with native audio coverage or promise background notifications without tested platform support.
- Native purchase restoration, donations, app-store billing, and Android-specific OS settings are not part of the Web product.
- Supplied catalog counts and versions are authoritative for shipped content. Future content updates must preserve profile identity and offer a versioned migration path.

## Acceptance gates

### Data and domain

- Source database remains unchanged. Derived catalog excludes analytics/mistake tables.
- Queries and parsers preserve supplementary Unicode, reading variants, duplicate associations, absent paths, and annotated sentence text.
- Scheduling, queue creation, rating updates, session persistence, backup/extension validation, and handwriting geometry have focused automated tests.

### Offline and persistence

- Production browser tests initialize actual bundled catalog assets, verify readiness, disable network, reload, and exercise library, detail, search, all four study modes, profile updates, backup export, and extension reading.
- Interrupted resource downloads retry safely and never erase profile data.
- A page reload during a saved session resumes its queue and score without double-counting completed work.
- Upgrading the app shell does not silently reset progress or strand an incompatible catalog.

### Visual and interaction

- Inspect desktop and narrow-mobile layouts with real Japanese content; no clipped actions or horizontally overflowing dialogs.
- Writing works with mouse and touch/pointer events and produces observable feedback against stored stroke geometry.
- Empty collections, unavailable data, completion, and errors provide usable next actions.
- Keyboard navigation and accessible control names cover principal journeys.

### Release evidence

- TypeScript, production build, relevant unit tests, and browser acceptance tests pass.
- Docker build/static serving is verified where a Docker daemon is available; otherwise state the specific unverified limitation.
- Real Android/iOS home-screen installation, OS eviction behavior, offline voice availability, and device memory must be reported separately from desktop Chromium/WebKit emulation.
- `docs/project-plan.md` and release verification document identify completed gates and remaining concrete limitations without broad unsupported parity claims.

## Independent study behavior

The Web implementation uses explicit, testable algorithms instead of implying access to Android internals:

- Flashcard grades Again/Hard/Good/Easy map to four saved ratings. Guided review intervals are described in `src/domain/study.ts`; successful quiz/reading/writing answers feed the same local scheduler.
- The optional quiz timer gives a base duration selected by the learner. The actual duration is `base × (1.5 − 0.5 × historical accuracy)` for that character; new characters therefore receive 50% extra time. Hidden choices start the timer only when revealed. Timed-out items are counted as missed. Feedback may advance automatically after 1.5 seconds.
- Quiz choices remain stable for a particular saved-session encounter, even when another profile field is saved. Distractors exclude duplicate rendered answers. Word gaps include their reading and gloss; sentence gaps include the translation to disambiguate possible completions. Missing word/sentence context is explicitly labeled and falls back to a meaning prompt.
- Writing samples both the input and the ordered SVG stroke at equal arc-length intervals. Direction-sensitive endpoint checks and mean distance check the stroke in its original 109×109 coordinate space. Relaxed/normal/strict modes multiply spatial tolerances by 1.35/1/0.7. Automatic and manual per-stroke checking use the same matcher. Hints are optional; free writing and entries without paths use self-assessment.
- Ordinary repeat-mistake sessions append each missed character at most once. Session advancement and progress events are committed in the same IndexedDB transaction, with stable event identifiers. Unsupported reading entries are skipped without counting a failure.
- Sentence reading combines catalog examples and explicitly imported licensed reading packs; previously unread examples appear first. KLC/Outlier texts are not invented.

## Native parity boundaries at delivery

These boundaries describe the agreed Web adaptation, rather than missing core workflows:

| Native-specific area                      | Delivered Web behavior and boundary                                                                                                                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paid explanatory and graded-reading texts | KLC and Outlier full texts are outside the user-approved completion scope. Validated extension packs can attach authorized explanations and readings later; Android purchase restoration and proprietary package conversion are not implemented.                             |
| Exact private study algorithms            | Guided review scheduling, adaptive timers, and stroke geometry are independent documented algorithms. The four study modes and their persistent outcomes are implemented; binary equivalence to Android internals is not claimed.                                            |
| Cloud or population-level services        | Local transactional profiles and portable backup files replace online backup; personal mistakes replace the Android population-wide mistake aggregate. The app has no account service or traditional backend.                                                                |
| Device-specific integration               | Manifest installation, responsive standalone navigation, browser file import/export, and a calendar reminder file provide Web equivalents. Android billing, donations, native widgets, app-store links, and background push services are outside the static offline product. |
| Source snapshot and translations          | All supplied records are retained. A newer Android dictionary snapshot and missing multilingual glosses are not fabricated. The UI uses English; Japanese content retains its supplied readings and forms.                                                                   |
| Audio and missing stroke data             | The offline bundle includes 8,132 native audio clips with source coverage recorded separately. Optional device speech is labeled as such. The 628 kanji without source paths offer honest free writing/self-assessment rather than a fabricated recognition score.           |

Platform verification is a separate release-evidence question: desktop Chromium/WebKit coverage does not establish physical iOS installation, storage eviction behavior, or memory safety on every device. Record Android emulator measurements and any unrun physical-device checks explicitly.
