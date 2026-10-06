# Verification Strategy and Release Gates

Status: test plan; individual cases are not passed until a run and result are recorded.

## 1. Scope and Evidence

The verification objective is a usable, maintainable, fully offline study application with feature behavior traceable to the observed Android application. A successful build, a screenshot, or a high test count is not by itself evidence of parity.

Every required feature should have an entry in the product requirements matrix with its source observation, web behavior, implementation location, automated check, manual check where necessary, and current status. Distinguish **passed**, **failed**, **not run**, and **blocked**. Store actual run commands, tool versions, relevant device/browser versions, and concise results in a release verification report.

## 2. Test Layers

| Layer | Purpose | Recommended tool |
| --- | --- | --- |
| Static checks | Invalid types, module contracts, unused or unsafe patterns, production build failures. | TypeScript, ESLint, Vite production build. |
| Pure domain tests | Search normalization, catalog parsers, scoring, scheduling, date rules, session transitions, backup validation. | Vitest with deterministic fixtures and injected clocks/randomness. |
| Catalog integration | Real SQLite schema, queries, associations, counts, source transformations. | SQL.js with the generated distributable database; build script checks. |
| Storage integration | Atomic answer persistence, migration, import rollback, multiple writes, restart behavior. | IndexedDB test adapter for focused cases plus real-browser checks. |
| Browser acceptance | Complete user journeys, workers, navigation, service workers, offline operation, exports and imports. | Playwright against the production build. |
| Device acceptance | Home Screen installation, mobile memory, touch writing, actual iOS storage, OS suspension, offline audio. | Physical Android and iOS devices where available. |
| Visual/accessibility review | Responsive geometry, typography, contrast, focus, dialogs, touch targets, Japanese glyphs. | Browser screenshots, keyboard checks, screen reader spot checks, optional axe. |

Tests should assert domain outcomes and persistent state, not mirror private functions or CSS implementation details. Prefer user-visible queries by role and accessible name in browser tests. Do not build a large snapshot suite for trivial components.

## 3. Catalog Build Gates

Run these checks whenever source content, parsing, or catalog preparation changes:

- Source is opened read-only, its hash is recorded, and SQLite integrity checks pass.
- Distributable content counts match the supplied snapshot or an explicitly documented transformation: 7,045 kanji, 265 radicals, 148 kana, 214,894 vocabulary entries, 87,950 names, and 16,277 sentences.
- Historical `analytics`, `quiz_mistake`, and `draw_mistake` data is absent from the fresh-user artifact and never appears in personal state.
- All ordinary documented relationships resolve. Component links intentionally outside the radical/kanji catalogs remain present.
- All twelve classification sequence columns retain their complete ordering. Unclassified entries are handled intentionally.
- Nonempty stroke path counts match declared counts. The 628 kanji without paths have a tested UI state.
- Supplementary-plane character `𠮟` remains intact through the database, API, route, UI, group membership, and backup.
- Readings, gloss templates, sentence ruby, uncommon forms, and empty written forms parse without leaking raw control markup into ordinary display.
- Generated manifest byte length and hash match the emitted asset. Required worker/Wasm/media files are in the production output.

Use golden examples for understandable assertions and scan the full catalog for parser crashes. Coverage by a small hand-picked list does not prove full data compatibility.

## 4. Domain Cases

### 4.1 Study Sessions

| Case | Expected result |
| --- | --- |
| Start from a catalog level or custom group | Queue contains precisely the eligible kind-qualified IDs, with intentional filtering and ordering. |
| Empty eligible selection | Explanatory empty state; no invalid question or endless loading. |
| Recognition options | One unambiguous correct answer; unique distractors; no duplicate labels that make grading ambiguous. |
| Wrong response and retry | Mistake and duration are recorded once; retry behavior matches session rules. |
| Rapid double activation | A single review event and single advancement. |
| Reload or suspend after an answer | Answer and next position restore together, without losing or duplicating progress. |
| Complete/exit/restart | Summary matches committed results; abandoned versus completed sessions are represented correctly. |
| Review scheduling | Documented algorithm produces deterministic next due dates for all ratings. |
| Day boundary and time-zone change | Daily goals and streaks follow documented local-day rules; no negative duration or duplicate day. |

### 4.2 Writing Evaluation

Use vector-derived reference traces for deterministic geometry checks and a small reviewed set of human traces for tolerance calibration. Mathematical tests alone do not establish a pleasant writing experience.

- Accept correctly ordered reference traces and modest noise/point-density variation.
- Reject a reversed stroke, wrong stroke, wrong location, gross scale mismatch, and out-of-order stroke.
- Do not accept a short tap as a complete long stroke.
- Preserve pad coordinate conversion when resized, at high device pixel ratio, and after orientation change.
- Undo, clear, hint, skip, and replay each have explicit effects on both displayed geometry and recorded result.
- Cancelled pointers and multi-touch do not create phantom strokes; writing does not scroll the page.
- Missing reference paths never yield a fabricated accuracy score.
- Reduced motion changes animation behavior without hiding stroke order information.

### 4.3 Personal State and Backups

- A fresh installation has empty progress, even though the source snapshot included learner statistics.
- Group membership uses entity kind plus ID; the same code in radical and kanji domains does not collide.
- Notes, custom readings/meanings, order, settings, and review data persist after restart.
- Export and import round trip every supported personal field and Unicode character.
- A supported older backup migrates according to a fixture; a future schema is rejected clearly.
- Truncated JSON, wrong app identifier, invalid arrays/types, impossible values, duplicate IDs, and excessive input size are handled before writes.
- Failed import or quota failure leaves previous state unchanged.
- Merge conflicts and replacement semantics match the preview shown to the user.
- Concurrent tab operations do not lose progress or overwrite more recent group edits with stale full snapshots.
- A blocked IndexedDB upgrade gives actionable guidance and never silently creates a new empty profile.

## 5. Browser Acceptance Journeys

Use the real production build and real catalog for final acceptance. A small catalog fixture can accelerate routine component tests, but cannot replace full initialization and worker tests.

| ID | Journey | Required assertion |
| --- | --- | --- |
| E2E-01 | Fresh visit -> initialize -> ready | Progress is visible; completion follows verification; counts and initial progress are correct. |
| E2E-02 | Browse -> classification -> character detail | Correct meaning, readings, components, metadata, and adjacent navigation. |
| E2E-03 | Search kanji, kana, romanization, English, and components | Results follow documented matching semantics; stale responses never overwrite newer input. |
| E2E-04 | Detail -> vocabulary -> sentence/name/reference | Related entries resolve, ruby displays correctly, and navigation can return. |
| E2E-05 | Create/edit/reorder group -> study | Membership and ordering persist and drive the selected study session. |
| E2E-06 | Flashcards and quizzes -> summary -> statistics | Results and daily totals agree after reload. |
| E2E-07 | Writing practice -> feedback -> review | Actual drawn geometry affects grading; hints and mistakes are reflected correctly. |
| E2E-08 | Edit settings/customizations -> export -> reset -> import | User state is restored according to the backup preview. |
| E2E-09 | Download ready -> offline -> close/reopen -> use all routes | Every required feature works without previously visiting its route online. |
| E2E-10 | Install release A -> stage B during a session -> accept update | Session survives, progress remains, B starts consistently, and offline restart works. |
| E2E-11 | Interrupted/truncated/corrupt catalog | Ready is never reported; retry recovers; a previous ready catalog remains usable. |
| E2E-12 | Content cache removed with personal state retained | Repair state is shown, personal data survives, and redownload restores functionality. |
| E2E-13 | Required audio offline | Each supported playback path resolves local assets or a verified local synthesis engine. |

### 5.1 Offline Test Procedure

1. Start a clean browser context against the production server with service workers enabled.
2. Initialize and wait for the actual ready state and controlling service worker.
3. Confirm expected cache assets and database metadata; do not use only `navigator.onLine` as proof.
4. Take the browser context offline, reload, and open previously unvisited routes and records.
5. Search the full vocabulary catalog, open examples, animate strokes, complete study, edit a group, and export progress.
6. Close the page and reopen it in the same stored browser profile while offline; assert durable state and worker startup.
7. Return online only after the offline assertions finish.

Playwright documents distinct service-worker network events and routing behavior. Design fault injection at the correct owner and do not accidentally block service workers in the configuration used to claim offline support. [Playwright service worker documentation](https://playwright.dev/docs/service-workers)

### 5.2 Failure Injection

Exercise at least a failed response, truncation, manifest hash mismatch, quota/storage write failure, worker initialization failure, and interrupted update. Verify the recovery behavior through the application UI and the stored ready pointer. An error toast alone is insufficient when a corrupted resource remains marked ready.

For release upgrades, build two versions with distinguishable content or shell markers and a compatible personal schema. Serve them sequentially at one origin. Test the case of one old tab remaining open while another accepts an update.

## 6. Mobile and Visual Acceptance

Minimum layout sizes: 320 px narrow phone, a typical 390 px phone, tablet portrait/landscape, and desktop. Test light/dark themes, safe areas, large text, reduced motion, and long readings/meanings. No horizontal page overflow, clipped controls, inaccessible close actions, or canvas overlap is acceptable.

Interactive targets should have comfortable touch size. Dialogs must expose a name, trap focus appropriately, restore focus on close, and be dismissible by keyboard. Selected tab, answer correctness, and progress state must not rely only on color. Japanese glyph fallback must cover the delivered catalog or disclose a missing glyph without replacing it with an unrelated character.

For physical-device release verification:

| Platform | Checks |
| --- | --- |
| Android Chrome installed PWA | Install, cold offline launch, large catalog initialization, touch/pen writing, back navigation, orientation, suspend/resume, export/import. |
| iOS Safari Home Screen app | Add to Home Screen, launch installed context, initialize there, airplane-mode cold launch, stored progress after suspension, file import/export, safe areas, touch writing. |
| Desktop Chromium | Main automated production acceptance suite and keyboard interaction. |
| Desktop WebKit | Automated layout/runtime coverage where supported, explicitly not a substitute for iOS installation testing. |

If hardware is unavailable, record that acceptance as **not run**. Do not infer a successful Home Screen deployment from desktop browser emulation.

## 7. Performance Budgets

Budgets are initial product targets to calibrate with measured hardware, not claimed results:

| Operation | Target |
| --- | --- |
| App shell interaction | Remains responsive during catalog download, digest, and query work. |
| Indexed character detail | Normally under 150 ms once worker is ready, on reference hardware. |
| Search response | Normally under 300 ms after debounce for representative queries; stale work is bounded. |
| Drawing feedback | Visible within the next frame or promptly after pointer release; no long main-thread query tasks. |
| Offline cold start | Record worker/database load time and peak memory; it must reliably fit supported mobile devices. |

Measure actual full-catalog initialization, common and worst-case search, repeated navigation, and long study sessions. A desktop benchmark does not settle mobile memory safety. Improve a measured bottleneck at its layer instead of introducing speculative caching everywhere.

## 8. Docker and Release Gates

- A clean locked-dependency install, type check, lint, required automated tests, and production build pass.
- The content preparation script reproduces correct counts and manifest verification.
- Docker builds without using unstaged local artifacts; the runtime serves the correct manifest, icons, Wasm, worker, and database MIME/content.
- Deep navigation succeeds. Missing static assets return a failure instead of the SPA HTML document.
- Cache-control and TLS deployment requirements match [the architecture](architecture.md).
- The container does not need a backend, user database volume, or runtime network dependency.
- Feature parity items all have evidence; no dead action controls are counted as implemented features.
- Offline restart and backup restore pass using production assets.
- Remaining untested device behavior or source-data gaps are stated accurately in release notes.

Record the exact tested commit and commands once the checks pass. Repeat broad verification only after a change invalidates its evidence; otherwise continue toward delivery.
