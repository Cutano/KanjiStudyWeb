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

The baseline application source is commit `680022d`; the verification/container milestone is `4a5acab`. Tests used shell cache `kanji-shell-7104588003179bf0` (`index-BOE7QUiE.js`, `index-YfI-4P67.css`). Subsequent asset changes and their verification are recorded below.

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

## Icon follow-up — 2026-10-07

Replaced the abstract mark in `public/icon.svg` with an original six-stroke vector drawing of 字. The green background and cream strokes remain; the decorative gold dot was removed. Regenerated the 192px and 512px installation icons with `node scripts/generate-icons.mjs`. The artwork uses local paths and does not depend on a font.

- `npm run typecheck` and `npm run build` passed; the new shell cache is `kanji-shell-cacad728fff2c6d7`.
- `npx playwright test tests/e2e/offline-catalog.spec.ts --grep 'complete catalog'` passed both Chromium desktop and WebKit mobile cases using the real bundled catalog and production service worker.
- Visually inspected 32px, 64px, and 192px SVG rendering, a circular PNG mask, and onboarding at 1440px desktop and 390px mobile widths; the glyph is legible and the pages have no horizontal overflow.
- A separate Chromium production check verified that all three icon assets match the source bytes, including after initialization and an offline reload.

This follow-up verifies the updated local production build. The baseline Docker image and installed-device report above have not been regenerated for this artwork change.

## README screenshot and sidebar follow-up — 2026-10-07

The previous desktop illustration combined a 1440 × 1080 viewport with a 1440 × 1364 full-page capture. The fixed sidebar correctly covered the viewport but ended 284 px before the captured document bottom, creating an apparent layout break. The [desktop overview](screenshots/overview-desktop.png) now uses a real 1440 × 1364 viewport and a viewport-only screenshot, taken after the production library and fonts loaded. Its served icon was compared directly with the current `public/icon.svg`. No screenshot-only styling or image compositing was applied.

Inspection also reproduced a separate application defect at 1280 × 600: the fixed sidebar's settings link was below the visible window (y = 691–736), and the sidebar could not scroll. The sidebar now scrolls vertically when necessary, contains scroll overshoot, and preserves its children's natural sizes. Tall windows retain the existing bottom-aligned layout.

Verification against production shell `kanji-shell-c98413d19c1bd0d2`:

- `npm run typecheck`, `npm run build`, and all **62 unit/integration tests** passed.
- **10 existing production browser cases** passed in Chromium and mobile WebKit: onboarding and light/dark WCAG checks, collection-dialog keyboard behavior, and actual catalog/audio/favorites persistence through a cold offline reload. The WebKit offline case shut down its static origin.
- **24 targeted layout checks** passed: Chromium and WebKit × light/dark themes × 1440 × 1080, 1366 × 768, 1280 × 600, 844 × 390, 390 × 600, and 320 × 568 viewports, all using Larger text. Checks covered no horizontal page overflow, full sidebar viewport coverage, reaching the settings link with the keyboard, activating it, and scrolling to the offline status. Overflowing sidebars scrolled without moving the underlying page. WebKit link traversal used Option+Tab.
- Visually inspected the refreshed desktop screenshot and short-window/mobile navigation captures. Formatting and whitespace checks passed for the changed text files.

These are local production and automated browser checks. The Android emulator screenshot and installed-device report remain the earlier recorded evidence; physical iOS acceptance and a rebuilt Docker image were not part of this follow-up.

## Sentence controls follow-up — 2026-10-07

Moved Furigana and Separate linked words below the example sentence and translation, aligned to the right of Mark as read. Both controls now use native buttons with `aria-pressed`, subtle selected backgrounds, visible keyboard focus, and 44px minimum touch-target height. At narrow widths the options wrap to a right-aligned second row. Furigana retains its persisted profile preference; word separation retains its existing per-page state.

Verification used the real bundled catalog and local production build:

- TypeScript checking, production build, formatting, and whitespace checks passed.
- Both existing offline dictionary acceptance cases passed in Chromium and mobile WebKit after updating the old checkbox selectors to button selectors. These cases shut down the static origin and reload through the production service worker.
- All four existing light/dark dictionary accessibility cases passed in Chromium and mobile WebKit.
- A targeted browser check verified Space/Enter activation, pressed state, reading visibility, furigana persistence after reload, and word spacing in both engines. Twelve layout checks covered both engines, both themes, and 1440px, 390px, and 320px widths; all retained right alignment without horizontal overflow. Desktop and narrow mobile captures were visually inspected.

These are automated browser checks, not new physical iOS or installed Android verification.

## Compact sentence controls follow-up — 2026-10-07

Supersedes the previous sentence footer sizing and wrapping behavior. The toggles now share the Mark as read text-button typography and vertical padding, with smaller corner radii and no border or minimum-height expansion. At widths up to 640px they show 16px icons with accessible names, title hints, and the existing pressed state. The footer stays on one line.

- TypeScript checking and production build passed.
- Twenty-four production layout checks passed across Chromium/WebKit, light/dark themes, and widths of 1440, 768, 641, 640, 390, and 320px. Each footer and each read button measured 32.8px tall; both toggle buttons matched their vertical position and height, and the options stayed right-aligned without horizontal overflow. Mobile icon targets measured 32 × 32.8px.
- Keyboard activation, furigana visibility and persistence, and word spacing passed in both engines. Desktop and 320px mobile captures were visually inspected.
- The existing two production offline dictionary cases and four light/dark accessibility cases passed. This remains browser simulation rather than physical-device acceptance.

## GitHub source publication — 2026-10-07

Created the public repository [Cutano/KanjiStudyWeb](https://github.com/Cutano/KanjiStudyWeb) and configured it as the local `origin`. Source publication retains the existing commit history and the immutable supplied database; generated bundles, downloaded audio archives, and original APKs remain excluded by the existing ignore rules.

- Reviewed tracked files and all reachable historical blob paths for prohibited archives and sensitive filenames; checked historical text blobs for common API-token and private-key patterns, with no matches. This is a targeted check, not an exhaustive secret audit.
- `npm run typecheck`, all **108 unit/integration tests**, `npm run build`, `npm run format:check`, and `git diff --check` passed before publication.
- Browser and installed-device acceptance were not rerun for this source publication; their evidence remains in the reports above and `ai-speech.md`.

Publishing the Git repository does not deploy a public application origin. Docker and HTTPS hosting remain documented in `deployment.md`.

## Multi-platform container verification — 2026-10-07

Built source revision `f093b7b3819984ec0ffa3fed9db4e5e78b590e7d` with the existing digest-pinned Dockerfile for `linux/amd64` and `linux/arm64`. The application version is `0.2.0`; OCI labels identify its GitHub source and revision.

- Both variants started with a read-only filesystem, a temporary `/tmp`, all Linux capabilities dropped, and `no-new-privileges`. Static host checks passed for the shell, icons, Wasm, nine catalog/audio assets, cache headers, speech-provider CSP, and missing-asset behavior.
- All nine content asset byte lengths and SHA-256 digests matched the served manifest on both variants. Both used catalog version `18993e9136e118e785b8`.
- On the arm64 container, Chromium and WebKit each initialized the real library, opened 学, and saved a favorite. After stopping the container and verifying the origin was unreachable, fresh pages reopened the dictionary through the production service worker, retained the favorite, and decoded the native 学校 recording without page errors.
- The arm64 container reached Docker's healthy state. The amd64 variant's health command passed under Docker Desktop emulation on the arm64 host; this is not a native x86 hardware test. Browser acceptance used the arm64 variant and does not constitute physical-device acceptance.
- The unchanged application source passed TypeScript checks, **108 unit/integration tests**, and a local production build during the preceding GitHub publication. Documentation formatting and whitespace checks passed for the container usage instructions.

Published to the public Docker Hub repository [cutano/kanji-study-web](https://hub.docker.com/r/cutano/kanji-study-web). Registry inspection confirmed both Linux architectures and retained build provenance attestations. The release index digest is `sha256:b62e01fb6910c4c37aab6551b98d70d10e04c2c4f7a21f982749a75778d2a111`; tags `0.2.0`, `sha-f093b7b`, and `latest` identify that index. Anonymous Docker Hub API reads confirmed the repository is public. Credentials were read only through Docker's configured credential helper and were not stored in the project or image.

The fixed release can be pulled as `cutano/kanji-study-web@sha256:b62e01fb6910c4c37aab6551b98d70d10e04c2c4f7a21f982749a75778d2a111`. Publishing this image does not provide an HTTPS application hostname.

## Topbar search styling follow-up — 2026-10-07

The topbar search previously inherited the generic yellow input focus outline around its square inner input. It now shares Library search's sage `:focus-within` outline around an 8px rounded outer control, with a theme-aware surface, border, and icon color. The inner input outline is suppressed only within these search controls; other controls keep their existing focus treatment. Compact spacing and responsive widths remain appropriate for the header.

- TypeScript, production build, formatting, and whitespace checks passed. This is a CSS-only change; no new permanent tests were added and the unrelated unit suite was not rerun.
- Eight focused browser checks passed: Chromium at 1440px and 320px, and WebKit at 390px and 320px, each in light and dark themes. The whole-control focus matches Library (2px sage outline, 2px offset, 8px corners), the inner input has no outline, and there is no horizontal clipping or page error. `/` still focuses topbar search, and Enter routes 今日 to the dictionary results.
- Inspected [desktop light](screenshots/topbar-search-desktop.png) and [mobile dark](screenshots/topbar-search-mobile.png) focused-state captures from isolated browser contexts.
- The local Docker deployment rebuilt and started healthy. Static host checks passed for the shell, icons, Wasm, nine content assets, cache headers, CSP, and missing assets. The entry assets are `index-CEObIdxH.js` and `index-xg9xY10Q.css`.

This follow-up updates the local deployment; the published Docker Hub release described above remains unchanged.

## Character layout follow-up — 2026-10-07

At widths up to 640px, the Character page now places its full-width kanji card above separate full-width Practice and Add buttons. The familiarity section follows these actions. The 641–850px layout retains its two columns, with a minimum card width and wrapping action labels to avoid compressing the stroke controls.

Stroke controls shared by Character details and study views now use 36 × 36px buttons. The original broad SVG rule also applied the glyph's vertical margins to the button icons, making the controls unnecessarily tall; it now targets only the diagram's direct SVG. The counter uses nonshrinking, nonwrapping tabular digits so `4 / 4` and two-digit counts remain horizontal.

- TypeScript, production build, formatting, and whitespace checks passed. This CSS-only refinement adds no permanent tests and does not rerun the unrelated unit suite.
- Focused production checks passed in Chromium and WebKit at 320, 390, 640, 641, 850, 1180, and 1440px, across both themes and the real 日 and 鬱 catalog entries: 28 viewport/theme configurations and 56 character checks. Every control measured 36 × 36px, with contained icons; `4 / 4` and `29 / 29` remained single-line, and there was no horizontal overflow. At widths up to 640px, both action buttons were below the card and matched the aside's full width.
- Previous/next stroke, play/pause/replay, Practice setup, and Add dialog opening/closing passed in both engines. Inspected [mobile dark layout](screenshots/character-mobile-layout.png) and [desktop light controls](screenshots/character-desktop-controls.png) from isolated browser contexts. These are browser simulations, not physical-device acceptance.
- Local Docker rebuilt and started healthy. Static host verification passed for the shell, icons, Wasm, nine content assets, cache headers, CSP, and missing assets. The verified entry assets are `index-DNDS-HC0.js` and `index-DDz7RQDn.css`; the public Docker Hub image was not republished by this refinement.

## Version 0.2.2 release — 2026-10-07

This release includes the independent AI speech enable switch, Library-style rounded topbar search focus, and the Character page's stacked mobile actions with compact square stroke controls. The package version and deployment examples now use 0.2.2. The release retains the static, offline-first architecture and the existing catalog version; no new database or profile migration is introduced.

Git tag [`v0.2.2`](https://github.com/Cutano/KanjiStudyWeb/tree/v0.2.2) identifies source revision `3526807f8c3c51bd9bbd643108a811e47817fa13`. The tag and `main` were pushed to GitHub. Docker Hub tags `0.2.2`, `sha-3526807`, and `latest` all identify the verified multi-platform index `sha256:65db562fa842d1405e5740a15b122d482514cf7879e6d71fd9e28e32ab6029e2`.

- Release preparation passed all 111 unit/integration tests, TypeScript checking, production build, formatting, and whitespace checks. Dependency versions, the protected repository instructions, and the source database remain unchanged.
- The first concurrent multi-platform build exposed a shared temporary-catalog race: one platform removed the other platform's `catalog.sqlite` from the BuildKit cache. The data-preparation mount now uses `sharing=locked`, serializing access while retaining the verified audio download cache. Application code and the generated-data contract are unchanged by this Docker build correction.
- All 32 production Playwright cases passed without retries: 16 Chromium and 16 mobile WebKit cases, including AI speech controls, both-theme accessibility, study workflows, offline installation/recovery, and checkpoint preservation through shell updates.
- Both rebuilt container variants passed static-host checks and byte-length/SHA-256 verification of all nine catalog/audio assets. Their OCI version and source-revision labels match 0.2.2 and the tagged commit. Catalog version remains `18993e9136e118e785b8`.
- Chromium and WebKit initialized the actual arm64 container, saved a favorite, and then reopened fresh pages with the container stopped. Favorite persistence, cold offline routing, and native audio decoding passed without page errors. The amd64 health command passed under Docker Desktop emulation; this is not a native x86 or physical iOS hardware test.
- Registry inspection confirmed both `linux/amd64` and `linux/arm64` variants, retained provenance attestations, and identical digests for all three published tags. An anonymous Docker Hub read confirmed that the repository remains public. The verified release image also replaced the local container at `http://localhost:8080`, where static hosting checks passed.

Pull the immutable release with `docker pull cutano/kanji-study-web@sha256:65db562fa842d1405e5740a15b122d482514cf7879e6d71fd9e28e32ab6029e2`, or use `cutano/kanji-study-web:0.2.2` for the versioned tag.

## Version 0.2.3 local TTS repair — 2026-10-07

Added PCM output support for the user's Gemini TTS provider, WAV playback/cache encapsulation, and redacted provider error details. The six affected production browser cases and all 132 unit/integration tests pass; see the [PCM compatibility follow-up](ai-speech.md#023-pcm-compatibility-fix--2026-10-07) for the diagnosis, upgrade instructions, and verification evidence. Unrelated browser workflows were not rerun for this focused repair. This is a locally verified source/container version, not a Docker Hub publication or an upgrade to the user's public HTTPS server.

## Stroke tracing follow-up — 2026-10-07

The active stroke previously reused its faint guide path for the ink reveal, hiding the entire guide at animation start. It now has a separate guide underneath the ink, with matching geometry and stroke styling. A discrete opacity animation clears the guide only when the ink reveal finishes; both use the same speed-adjusted duration. Reduced motion immediately displays the ink with the extra guide hidden.

- TypeScript, production build, changed-file formatting, and whitespace checks passed.
- Targeted production checks in Chromium and WebKit examined all eight real catalog strokes of 雨 at 0.5×, 1×, 1.5×, and 2×. At the start, midpoint, and just before completion, guide opacity remained 0.07 while the ink advanced; at completion it became zero. Future stroke guides remained visible. Replay, pause, previous/next, keyboard activation, and reduced-motion behavior also passed without page errors.
- Inspected the [desktop light](screenshots/stroke-tracing-desktop.png) and [320px mobile dark](screenshots/stroke-tracing-mobile.png) captures halfway through the fourth stroke. The unfinished portion retains its guide, and neither layout has horizontal overflow.
- All four existing production acceptance cases for cold offline catalog loading and offline study workflows passed across Chromium desktop and mobile WebKit, using bundled data and the production service worker. WebKit's static origin was stopped for offline verification. No permanent tests were added for this presentation refinement; unrelated unit tests were not rerun.

This verifies the local production source build. Docker images and public hosting were not updated; these browser checks do not constitute physical iOS acceptance.

## Stroke endpoint flash follow-up — 2026-10-07

The user's recording and screenshot exposed a rendering issue missed by the preceding computed-style checks. With normalized `pathLength="1"`, the implicit `1 1` dash pattern placed the next dash's round cap at the stroke endpoint as the reveal began. Chromium painted this as a brief bright dot. The reveal now uses `1 2`, keeping the repeated dash outside the path while retaining the same ink length, duration, round tips, and guide behavior.

- Reproduced the flash on the third real catalog stroke of 雨 in Chromium: the endpoint pixel already matched fully drawn ink at 0 and 0.75ms, then returned to the guide shade. WebKit did not reproduce this artifact. Inspected the reproduced [before](screenshots/stroke-start-before.png) and corrected [after](screenshots/stroke-start-after.png) start frames.
- After the fix, endpoint pixels matched the guide within two channel levels at 0, 0.75, 7.5, 187.5, and 375ms, then matched completed ink at 750ms in both engines. This validates painted output rather than only the animation's declared styles.
- All eight strokes at all four speeds still passed guide/reveal timing checks in Chromium and WebKit. Replay, pause, previous/next, keyboard activation, reduced motion, and desktop/320px layouts passed without page errors.
- TypeScript, production build, changed-file formatting, and whitespace checks passed. The four existing cold offline catalog and offline study cases passed again across Chromium and mobile WebKit with real data and the production service worker; WebKit's origin was stopped. No new permanent tests or unrelated unit runs were added for this rendering correction.

Updated the open local test page through its normal app-update control and verified that it loaded `index-BwTiegal.js`. Docker images and public hosting remain unchanged; physical-device acceptance was not repeated.

## Version 0.2.3 release — 2026-10-07

Released PCM-to-WAV AI speech playback/cache support, bounded and redacted provider errors, persistent stroke guides during tracing, and the correction for the bright endpoint flash at stroke start. The package version is 0.2.3, and README/deployment examples now reference the published image. Catalog version remains `18993e9136e118e785b8`; no new catalog or profile migration is introduced by this release.

Git tag [`v0.2.3`](https://github.com/Cutano/KanjiStudyWeb/tree/v0.2.3) identifies source revision `dfd57289fa950603836ed0f3d8ebaa76894ecf34`. Both the tag and `main` were pushed to GitHub. Docker Hub tags `0.2.3`, `sha-dfd5728`, and `latest` identify the same verified multi-platform index, `sha256:c1030b2aad2188eb461490b865517b5bc04e5226469f443bb401fdeeeef45547`.

- Release verification passed TypeScript, all **132 unit/integration tests**, the production build, full formatting, and whitespace checks. All **34 production Playwright cases** passed without retries: 17 Chromium desktop and 17 mobile WebKit cases, including PCM-only providers, cached audio playback, accessibility, full-catalog offline reload, interrupted installation, and checkpoint preservation through a shell update. The focused stroke pixel/timing verification is recorded above and uses the same production entry asset, `index-BwTiegal.js`.
- Both `linux/amd64` and `linux/arm64` images passed static-host checks, byte-length/SHA-256 verification of all nine content assets, and OCI version/source-revision checks. The pinned Dockerfile retains serialized access to its shared catalog-generation cache.
- Chromium and WebKit initialized the actual arm64 container, saved a favorite, and reopened fresh pages with the container stopped. Cold offline routing, favorite persistence, and native audio decoding passed without page errors. The arm64 container reached healthy status; the amd64 health command passed under Docker Desktop emulation on the arm64 host.
- Registry inspection verified both architectures, two build provenance attestations, and identical release digests for all three tags. Anonymous Docker Hub access confirmed the repository remains public. The published digest matches the locally tested image; no rebuild occurred between verification and publication.

Pull the fixed version with `docker pull cutano/kanji-study-web:0.2.3`, or pin the immutable image using `cutano/kanji-study-web@sha256:c1030b2aad2188eb461490b865517b5bc04e5226469f443bb401fdeeeef45547`.

This publication updates GitHub and Docker Hub. It does not replace a user's running local or public HTTPS container; operators must pull and recreate that deployment. Physical Android/iOS acceptance was not repeated for this release.

## Word action layout follow-up — 2026-10-07

The reported うぬぼれ results mixed horizontal and vertical playback/favorite controls because Common, JLPT, and both buttons shared one wrapping flex container. Added separate metadata and button groups to the shared `WordRow`. At widths up to 850px, metadata appears above the action pair; only the metadata can wrap. Playback and favorite controls stay together without a fixed outer width that could clip an AI voice indicator. Desktop keeps the existing inline arrangement. Library, character vocabulary, related words, sentence vocabulary, and collection lists use this shared component.

- TypeScript and the production build passed; final entry asset is `index-D1m26caz.js`. Formatting and whitespace checks passed.
- All six existing dictionary acceptance cases passed on Chromium desktop and mobile WebKit, including real bundled data, production service-worker cold offline reload, and light/dark accessibility audits. No new permanent tests or unrelated unit runs were added for this layout correction.
- Focused inspection of the real three-row うぬぼれ results confirmed aligned playback/favorite buttons and no horizontal page overflow at 320, 390, 640, 850, 1024, and 1440 CSS pixels in Chromium, and 320, 390, 640, and 850 pixels in WebKit. Cases include Common plus N1, Common only, and neither label. Keyboard Tab moves from playback to favorite; Space toggles the favorite and the selection survives a new-page reload after the origin is stopped.
- Inspected [desktop](screenshots/word-actions-desktop.png) and [mobile](screenshots/word-actions-mobile.png) dark-theme captures. This is automated WebKit coverage, not physical iOS acceptance. Public image tags and HTTPS hosting are unchanged.
- Rebuilt the local Docker preview at `http://localhost:8080`; static-host checks passed for the shell, icons, Wasm, all nine content assets, cache headers, CSP, and missing-asset behavior. It serves the same final entry asset as browser acceptance.

## Input focus zoom follow-up — 2026-10-07

The mobile topbar and library search controls used 10–11px fonts; several settings and study controls also inherited compact text. Small form text triggers iOS focus zoom, as documented in [Salesforce's investigation](https://help.salesforce.com/s/articleView?id=005315442&language=en_US&type=1). The fix raises form-control text rather than restricting the user's viewport zoom. [WebKit's zoom guidance](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/) explains why preserving user zoom matters.

A single rule gives inputs, textareas, and selects `font-size: max(16px, 1rem)` on viewports up to 850px or devices with any coarse pointer. Touch devices remain covered at wider landscape/tablet sizes; the app's larger-text preference increases controls to 19px. The rule explicitly takes precedence over compact component fonts, replacing the separate mobile overrides in TTS and dialog forms. The viewport tag, pinch gestures, and scale are not modified by script. Settings fields can shrink within their grid track, correcting overflow found during larger-text verification.

- TypeScript and production build passed with entry asset `index-DdxvODek.js`; formatting and whitespace checks passed.
- All ten existing accessibility and collection cases passed across Chromium desktop and mobile WebKit, including both themes, keyboard dialogs, and production service-worker offline collection workflows. No new permanent tests or unrelated unit runs were added for this CSS correction.
- Focused inspection performed 51 control-focus checks in Chromium and 162 in mobile WebKit against the real bundled catalog after stopping the origin and opening a fresh page. Search, reading, word/sentence notes, progress, settings/TTS, collection dialogs, character customization, and quiz setup controls meet the 16px floor. Mobile checks covered 320px and 390px portrait widths and 844px and 1024px landscape widths, plus 19px settings controls under the larger-text preference. No horizontal page overflow remained. Wide desktop topbar text remains 11px.
- The emulated visual viewport scale remained unchanged through these focus checks, and the viewport contains no user-scaling restriction. These are computed-style/layout checks in desktop automation; they do **not** reproduce a physical iOS software keyboard, establish actual iOS focus-zoom behavior, or verify a physical pinch gesture. Confirm tapping search, notes, and settings in an updated iOS Home Screen installation, dismissing its keyboard, rotating the device, and manually pinching. Normal scrolling to reveal a focused field above the keyboard is expected.
- Inspected [focused mobile search](screenshots/mobile-input-focus.png) and [mobile settings](screenshots/mobile-input-settings.png). Public Docker Hub tags and HTTPS hosting are unchanged; an existing installed PWA needs the updated deployment and normal app-shell update, without clearing its study data.
- Rebuilt the local Docker preview at `http://localhost:8080` with the same final entry asset. Static-host checks passed for the shell, icons, Wasm, all nine content assets, cache headers, CSP, and missing-asset responses.

## Version 0.2.4 release — 2026-10-07

The user explicitly requested an all-platform `maximum-scale=1` viewport, accepting that browsers may also prevent manual pinch zoom. This supersedes the earlier minimum-control-font approach. The control typography is restored to its state before `99ef636`, including the original mobile dialog/TTS overrides. The settings-grid overflow correction and grouped word playback/favorite buttons remain. No catalog or profile migration is introduced.

- TypeScript, all **132 unit/integration tests**, the production build, formatting, and whitespace checks passed. Production entry assets are `index-CTK9a_yk.js` and `index-_X47_RVT.css`.
- All **34 production Playwright cases** passed without retries (17 Chromium desktop and 17 mobile WebKit), including real-catalog cold offline reload, study checkpoints through a shell update, speech caching, and the remaining accessibility checks.
- Focused Chromium and mobile WebKit checks covered 320, 390, 640, 850, 1024, and 1440 CSS pixel widths after removing the origin and opening a fresh offline page. The viewport directive persisted offline, search fonts returned to 10/11px on mobile and 11/12px on wider layouts, word buttons stayed horizontally aligned, and pages did not overflow. Mobile TTS controls retain their original 16px override; larger-text settings still fit. Desktop and mobile captures were visually inspected.
- Axe checks intentionally exclude only `meta-viewport`, documenting the requested scaling limit in each affected suite and in `testing.md`. Results for other rules are not a claim of unrestricted resizing or complete WCAG conformance.
- **User acceptance confirmed:** after upgrading to 0.2.4, the user reported that focusing inputs no longer zooms the page and pinch zoom is also prevented, matching the requested behavior. This is user-reported device evidence, separate from browser automation; the device model and OS version were not supplied. Update the deployed container and accept the application-shell update before testing; do not clear study data or reinstall the PWA.

Git tag [`v0.2.4`](https://github.com/Cutano/KanjiStudyWeb/tree/v0.2.4) identifies source revision `21b24ed1d4ef1d105a11f4e18d69de2127341aa4`; `main` and the tag were pushed to GitHub. Docker Hub tags `0.2.4`, `sha-21b24ed`, and `latest` all identify index `sha256:6206ad59ffe703b604a94541ceb1bc26f5b6902ed71002384520ac0ff28ec321`.

- Both `linux/amd64` and `linux/arm64` variants passed static serving checks, byte-length/SHA-256 verification of all nine content assets, and OCI version/source-revision checks. The catalog version remains `18993e9136e118e785b8`.
- Chromium and mobile WebKit initialized the actual arm64 container and saved a favorite. With that container stopped, new pages reopened offline with the new viewport directive, preserved the favorite, and decoded native word audio without page errors. The arm64 container reached healthy status; the amd64 health command passed under Docker Desktop emulation.
- Remote registry inspection confirmed both architectures, two provenance attestations, and identical digests for all three tags. The remote digest matches the locally tested image; there was no rebuild between verification and publication. Anonymous Docker Hub API access confirmed the release is public.

Pull the release with `docker pull cutano/kanji-study-web:0.2.4`, or pin `cutano/kanji-study-web@sha256:6206ad59ffe703b604a94541ceb1bc26f5b6902ed71002384520ac0ff28ec321`. This publication does not replace an existing deployment: pull and recreate its container, then select **Update app** in the installed PWA when the new shell is ready. The user subsequently confirmed the requested focus and pinch behavior as recorded above.

## Word metadata layout follow-up — 2026-10-07

The user reported that Common and N1 still stacked on the 自惚れ row in narrow layouts. The metadata group had wrapping enabled with 100px/80px width caps; its two labels could exceed those caps. Removed these narrow-layout overrides so the shared flex group keeps the labels in one natural-width row. The action buttons retain their separate horizontal group below the labels on narrow screens. Typography and the confirmed viewport policy are unchanged.

- Reproduced the label alignment failure at 320px against the 0.2.4 production bundle before the correction.
- TypeScript, production build, and all six existing dictionary browser cases passed on Chromium and mobile WebKit. Coverage includes the real catalog, service-worker cold offline reload, dictionary/sentence workflows, and light/dark accessibility checks with the documented viewport exception.
- Focused offline layout checks passed on both engines at 320, 390, 640, 641, 850, 851, 1024, and 1440 CSS pixels. Common/JLPT labels and playback/favorite buttons share their respective rows without overlap or horizontal page overflow. Search fonts and the viewport directive remain unchanged. Desktop and narrow mobile captures were visually inspected.
- Production entry assets are `index-Dz7urw64.js` and `index-hm5mhYKq.css`. No new permanent tests or unrelated unit runs were added for this CSS correction. The local Docker preview at `http://localhost:8080` was rebuilt with these assets and passed static-host checks for the shell, icons, Wasm, all nine content assets, cache headers, CSP, and missing-asset responses. The published Docker Hub 0.2.4 image remains unchanged; this is a subsequent source/local-preview fix.

## Favorites study button follow-up — 2026-10-07

The narrow heading-button rule hid text with `font-size: 0`, but the Favorites page's Study favorites action had no icon. This left a blank button, including the disabled empty state shown by the user. Added the existing Play icon with an explicit accessible name and tooltip. Replaced the blanket heading-button text suppression with a Favorites-specific rule: below 641px the button is a fixed 45px target with a centered 18px icon and hidden visual label; wider layouts show both icon and text. Empty character favorites keep the original disabled behavior.

- TypeScript, production build, formatting, and whitespace checks passed. All eight existing accessibility/keyboard browser cases passed on Chromium desktop and mobile WebKit with the documented viewport exception.
- Focused acceptance used the real bundled catalog on a fresh page after stopping the origin. Both engines passed empty and saved-character states in light/dark themes at 320, 390, 640, 641, 850, and 1440 CSS pixels: the icon remains visible, the text appears only at wider sizes, the button keeps its accessible name and touch target, and no page clipping occurs. Favorites-specific Axe audits passed with only the previously documented `meta-viewport` exclusion. Mobile empty-state and desktop populated-state captures were visually inspected.
- Clicking in Chromium and tapping in mobile WebKit opens the correct favorite-character setup. Keyboard Space/Enter activation and focus restoration after a keyboard-opened dialog passed; starting flashcards displays the saved 学 character offline. These checks use desktop browser automation, not a physical iOS device. No new permanent tests or unrelated unit runs were added for this presentation fix.
- The local Docker preview at `http://localhost:8080` now serves entry assets `index-CI8T_Uld.js` and `index-FdHBVUsF.css` and passed static-host checks. The published Docker Hub 0.2.4 image remains unchanged.

## Version 1.0.0 release — 2026-10-07

The user selected the current application as the 1.0.0 stable release. It includes both post-0.2.4 corrections: Common/JLPT labels stay horizontal in narrow word rows, and Study favorites remains visible as an accessible icon button on narrow screens. The all-platform `maximum-scale=1` policy and restored control typography remain as confirmed by the user's device testing. Core dictionary, study, collection, backup, extension-import, and offline workflows retain their accepted scope. No catalog or profile migration is introduced.

- TypeScript, all **132 unit/integration tests**, the production build, full formatting, and whitespace checks passed. Entry assets remain `index-CI8T_Uld.js` and `index-FdHBVUsF.css`, identical to the verified Favorites follow-up.
- The focused word-label and Favorites layout/interaction evidence immediately above applies to these unchanged application assets. Browser checks remain distinct from physical-device acceptance, and Axe retains the documented `meta-viewport` exception requested for the scaling policy.

- All **34 production Playwright cases** passed without retries (17 Chromium desktop and 17 mobile WebKit), including complete-catalog cold offline reload, interrupted installation, study checkpoints through a shell update, and speech-cache workflows.
- Both `linux/amd64` and `linux/arm64` images passed static serving, byte-length/SHA-256 checks for all nine content assets, and OCI version/source-revision validation. Catalog version remains `18993e9136e118e785b8`.
- With the actual arm64 container stopped, Chromium and mobile WebKit reopened fresh pages offline, retained a saved favorite, and decoded native word audio without page errors. The released Favorites icon and horizontal Common/JLPT labels were also verified in that offline container build. The arm64 container became healthy; the amd64 health command passed under Docker Desktop emulation.

Git tag [`v1.0.0`](https://github.com/Cutano/KanjiStudyWeb/tree/v1.0.0) identifies source revision `4d9b886ec78856030aadbdaf11c51db491a73d68`. The tag and `main` were pushed, and [Kanji Study Web 1.0.0](https://github.com/Cutano/KanjiStudyWeb/releases/tag/v1.0.0) was published as the latest stable GitHub release. Docker Hub tags `1.0.0`, `sha-4d9b886`, and `latest` identify index `sha256:2bb1840bc87bdc1809a09cbe0cb538e131fcaef492d1dfb35e4c926efbe8b483`.

Remote registry inspection confirmed both architectures, two provenance attestations, and identical digests for all three tags. The registry digest matches the locally tested image, with no intervening rebuild. Anonymous Docker Hub API access confirmed public availability.

Pull `cutano/kanji-study-web:1.0.0` or pin `cutano/kanji-study-web@sha256:2bb1840bc87bdc1809a09cbe0cb538e131fcaef492d1dfb35e4c926efbe8b483`. Publication does not replace existing deployments: recreate the deployed container from the new image and select **Update app** when the installed PWA offers the new shell. No study-data clearing or reinstallation is required.
