# Release Verification — 0.1.0

Date: 2026-10-07 (Asia/Shanghai). Scope: all researched core learning and reference workflows, with user-supplied extension import. This is an independent Web implementation; proprietary scoring internals and locked extension texts are outside the accepted scope.

## Content Delivered

| Content                           | Verified count |
| --------------------------------- | -------------: |
| Kanji                             |          7,045 |
| Hiragana / katakana               |        74 / 74 |
| Radicals                          |            265 |
| Vocabulary entries                |        214,894 |
| Names                             |         87,950 |
| Example sentences                 |         16,277 |
| Referenced native word recordings |          8,132 |
| Required verified resource files  |              9 |

The required catalog and audio payload is approximately 142.4 MiB (149 MB). The application shell is cached separately. The original supplied database SHA-256 remains `f0ab73a3a8d425455f93647c4305b76185d8156592df0cf534bbf4f7674ce4e6`. Source learning history is excluded from distributed reference tables and every new profile starts empty.

## Requirements Traceability

| Requirement                                  | Implementation evidence                                                 | Verification evidence                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| C01, C23: verified installation and storage  | `src/data/installer.ts`, `catalog.ts`, onboarding, Settings             | Installer integrity, abort/resume, failed update rollback, deletion ordering; production corrupt-download and cancellation acceptance    |
| C02, C03: installable static PWA             | Manifest, local icons, generated shell worker, Docker/Nginx             | Production browser cold reload, static-host smoke, device record below                                                                   |
| C04–C06: complete library, sequences, search | Typed SQLite worker repository; Library filters and paging              | Actual source-derived counts, domain identity, twelve sequences, kana equivalence, combined query and exclusion tests                    |
| C07–C09: details, strokes, dictionary        | Details, StrokeDiagram, text decoders                                   | Radical/base identity, non-Japanese readings, kana flags, stroke coverage, ruby/word variants, linked examples and recorded MP3 decoding |
| C10: personal customizations                 | Transactional profile, detail editor, favorites                         | Profile serialization/rollback/import tests; browser favorites and restored state                                                        |
| C11: collections                             | Collection domain, Sets, SetDetails                                     | Split/copy/move/reorder/remove, CSV/JSON import/export, offline full browser round trip                                                  |
| C12–C14: flashcards, quiz, writing           | StudySetup, StudySession, quiz generation, WritingCanvas                | Four-mode production study scenario; direction-sensitive stroke rejection/acceptance; scheduling/geometry/override tests                 |
| C15: reading                                 | Reading room and study reading; annotated sentences                     | Offline ruby, translation reveal, read tracking; imported reading/explanation acceptance                                                 |
| C16–C18: reviews, progress, lifecycle        | Independent scheduler, activity aggregation, stable session checkpoints | Daily new allowance, ratings, idempotent outcomes, tab conflicts, reload/resume; two-release shell test                                  |
| C19: audio                                   | Indexed local MP3 shards, AudioButton, optional local voice selector    | Exact 8,132 reference coverage and actual MP3 decoding before and after cold offline reload                                              |
| C20, C21: settings and backups               | Settings, validated profile schema                                      | Atomic restore, malformed import rejection, settings and profile browser round trip                                                      |
| C22: extension import                        | Versioned pack validation, Reading room, character explanations         | Offline import/reading, backup/reset/restore acceptance; documented original example pack                                                |
| C24: attribution                             | Offline license pages, source audit, runtime dependency notices         | Production shell precaches license text; repository LGPL/GPL notices and source hashes                                                   |
| C25: accessibility                           | Semantic controls, dialog keyboard support, theme tokens                | Automated WCAG 2/2.1/2.2 AA audits, keyboard focus loop/return, responsive browser screenshots                                           |

## Automated and Container Results

The final application source is commit `680022d`; the verification/container milestone is `4a5acab`. Later documentation-only commits do not change the verified bundle. Tests used shell cache `kanji-shell-7104588003179bf0` (`index-BOE7QUiE.js`, `index-YfI-4P67.css`).

| Check                                              | Result                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` in the clean Docker build                 | Passed on pinned Node 24 image; lockfile install, no audit vulnerabilities reported                                                                                 |
| `npm run data:prepare` in Docker                   | Passed; both input hashes verified; 9 assets, 149,359,576 bytes                                                                                                     |
| `npm run typecheck` and `npm run build`            | Passed with strict and unused-code checks                                                                                                                           |
| `npm test`                                         | **62 passed**, 10 files                                                                                                                                             |
| Production Playwright acceptance                   | **22 passed**: 8 catalog/extension, 2 study, 2 collection, 8 accessibility, 2 shell-update cases                                                                    |
| Browser versions                                   | Chromium **153.0.8010.12**, WebKit **26.6**; Playwright 1.63.0                                                                                                      |
| Automated WCAG audits                              | Zero violations on onboarding, nine main routes, and collection dialog; light/dark; both browser projects                                                           |
| Responsive inspection                              | 36 additional checks: 9 routes × 320/768 px × light/dark with Larger text; no horizontal overflow. Desktop 1440 px and mobile 390 px screenshots visually inspected |
| Production Nginx browser initialization            | Passed; no page errors or console/CSP errors; all seven primary routes fit the 768 px tablet layout                                                                 |
| `docker compose build`, `up -d`, static host smoke | Passed; unprivileged read-only service healthy on port 8080; shell/icons/Wasm/data/caching/CSP/404 behavior verified                                                |
| `npm run format:check`, `git diff --check`         | Passed; protected `AGENTS.md` unchanged                                                                                                                             |

Docker image: `kanji-study-web:local`, manifest digest `sha256:d2eea32681bdb39db39038aca6e7e6f0032e671dad2b4cb40f2491bec77f781e`. Local browser and Docker builds have identical application assets. Their SQLite writer-version/OS header metadata differ while all dictionary content matches; see the [reproducibility audit](research/data-audit.md#reproducible-release-environment).

Browser acceptance was split across coordinated ownership suites against the same frozen build, rather than rebuilding between projects. Reproduce the aggregate with `npm run test:e2e`. CI now runs the complete suite and retains reports and failure traces. Local Playwright output remains under ignored `test-results/`; durable illustrations are [desktop overview](screenshots/overview-desktop.png) and [mobile library](screenshots/library-mobile.png).

## Device Evidence and Practical Limits

Desktop browser automation includes Chromium and an iPhone-sized WebKit context. For WebKit offline tests, the static origin is actually shut down before reloading: its automation-only offline switch can fail before service-worker dispatch. Tests verify the origin is unreachable, then exercise cached content. This distinguishes actual resource unavailability from an automation-engine error.

The [Android installed-app report](android-verification.md) records successful native WebAPK installation on Android 17 / Chrome 149, 5.8-second initialization, 3.38-second unreachable-origin cold launch, all four offline study modes, actual renderer touch input and cancellation, native MP3 playback, portrait/landscape checks, and exact persistence of four review events after a second process restart. The main content renderer reported approximately 237 MiB PSS on the approximately 4 GB emulator; this was a snapshot, not a peak guarantee. No physical iPhone/iPad was available in this workspace: installation, suspension, memory pressure, storage eviction, and local speech on actual iOS hardware remain device acceptance checks. Safari's Home Screen storage can differ from browser-tab storage, so installation instructions require initializing inside the installed app.

An HTTPS public hostname was not supplied. Local Docker serving is verified; deployments on other devices require HTTPS and a stable origin. Browser storage can be cleared by the user or OS. The app requests persistent storage where supported and includes portable backups; no static PWA can override OS eviction policy.

The source lacks stroke geometry for 628 kanji, which use explicit glyph and self-assessment fallback. Native audio covers the referenced words, not every dictionary word or sentence. Optional speech selects only installed local Japanese voices. Calendar export supplies daily reminders without promising unavailable universal offline background notification APIs.

See [native parity boundaries](requirements.md#native-parity-boundaries-at-delivery), [source audit](research/data-audit.md), and [deployment](deployment.md).
