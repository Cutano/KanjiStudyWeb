# Kanji Study Web — Delivery Plan

## Product objective

Deliver an independent, maintainable, LGPL-3.0-or-later, browser-based implementation of the observed Kanji Study learning workflows. It must be installable on Android and iOS, work offline after initialization, and deploy as static files in Docker without an application server.

## Working agreements

- English engineering documentation and source identifiers; accessible, responsive product UI.
- Research the supplied Android reference and database before freezing repository guidance.
- Record observations, decisions, acceptance criteria, evidence, and unresolved gaps separately.
- Source database is immutable reference material. Its learning history does not belong to a new web profile.
- Do not represent inaccessible paid content, missing audio, or unverified browser capabilities as implemented parity.
- Preserve user data through updates. Export/import is a first-class feature.
- Commit coherent milestones; run checks relevant to each change.

## Accepted scope clarification (2026-10-07)

The user explicitly selected: complete all core features first and support later import of extension content. Full locked KLC Graded Reading Sets and Outlier dictionary text are therefore not release prerequisites. Provide documented, validated local extension import rather than locked or fabricated content. All available core catalog content and licensed Kanji alive native word audio remain in scope.

## Workstreams

| Workstream               | Responsibilities                                       | Deliverables                                           |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| Product research         | Observe Android navigation and study flows             | Original-app audit, requirements, parity matrix        |
| Data engineering         | Inspect encodings, content coverage, efficient queries | Data audit, reproducible catalog build, worker APIs    |
| Architecture and quality | Evaluate offline storage and browser behavior          | Architecture decisions, tests, reliability checks      |
| Product engineering      | Design and implement responsive workflows              | App shell, library, study, reading, progress, settings |
| Release engineering      | Production packaging and verification                  | Docker image, deployment guide, release evidence       |

## Milestones

1. **Research baseline:** observed functional inventory, data gaps, architecture decision, protected AGENTS.md.
2. **Foundation:** typed domain contracts, data preparation, worker queries, durable profile, production shell.
3. **Learning workflows:** library/search/details, flashcards, adaptive quizzes, handwriting, guided reviews, reading.
4. **Personalization:** custom sets, favorites, notes, ratings, statistics, settings, export/import.
5. **Offline release:** transactional initialization, service worker, install support, Docker and browser tests.
6. **Parity closure:** compare every requirement to implementation and evidence; document remaining external blockers.

## Completion gates

- All implementable, observed core workflows have working UI and automated acceptance coverage.
- Full supplied content is available offline with correct record identities and missing-data handling.
- User progress, customizations and backups survive reload and service-worker updates.
- Writing accepts plausible ordered strokes and rejects materially incorrect direction/shape.
- Cold offline navigation works after production initialization, including worker/WASM and deep links.
- Production build, meaningful unit/integration/browser tests, and container health check pass.
- Android/iOS platform limitations and unavailable original content are reported honestly.

## Status

All six delivery milestones are complete for the accepted core workflow and extension-import scope. Final verification passed 62 unit/integration tests, 22 production browser acceptance cases, Docker hosting checks, accessibility audits, and installed Android emulator offline acceptance. See `release-report.md` and `android-verification.md` for measured evidence. The unchecked release items are physical iOS Home Screen acceptance and deployment to a user-provided public HTTPS origin; no such device or hostname was available. Original paid extension texts, exact proprietary algorithms, and unprovided source content remain the documented boundaries rather than hidden completion claims.

## Post-release refinements

- 2026-10-07: Replaced the abstract application mark with the requested six-stroke 字 character, retaining the green and cream palette. Regenerated both PWA PNG sizes and verified small-size rendering, desktop/mobile layout, and production offline loading. See the icon follow-up in `release-report.md`.
- 2026-10-07: Refreshed the README desktop screenshot with the current 字 icon and a viewport matching the image height, eliminating the apparent sidebar cutoff caused by the earlier full-page capture. Fixed a separately reproduced short-window sidebar overflow so settings and offline status remain reachable by scrolling and keyboard. See the screenshot and sidebar follow-up in `release-report.md`.
- 2026-10-07: Added reference-verified vocabulary ranking, grouped senses with separate part-of-speech labels, mora pitch diagrams, and standalone offline sentence details. The original ranking prioritizes exact matches and JLPT; available sentence counts approximate ties because locked exercise counts are absent. See [dictionary parity follow-up](dictionary-parity.md) for implementation and verification evidence.
- 2026-10-07: Moved sentence display options into the right side of the read-action footer and replaced checkboxes with subdued, accessible toggle buttons. Narrow layouts wrap the options without clipping. See the sentence controls follow-up in `release-report.md`.
- 2026-10-07: Refined the sentence footer controls to match Mark as read typography and height, removing the earlier 44px minimum. At widths up to 640px, labeled icon buttons replace the text controls and preserve a single action row. See the compact sentence controls follow-up in `release-report.md`.
- 2026-10-07: Added optional user-configured AI speech after native recordings, with browser speech when unconfigured. Generated audio has persistent LRU limits of ten clips and 50,000,000 bytes; credentials and audio stay separate from study backups. See [AI speech](ai-speech.md) for architecture and verification.
- 2026-10-07: Added an immediately saved **Enable AI speech** switch. Turning it off uses browser speech for missing recordings while retaining API configuration and audio cache; existing installations preserve their previous enabled behavior. See the 0.2.1 follow-up in [AI speech](ai-speech.md).
- 2026-10-07: Created the public GitHub repository [Cutano/KanjiStudyWeb](https://github.com/Cutano/KanjiStudyWeb) for source publication with the existing commit history. See the publication checks in `release-report.md`; public website hosting remains a separate deployment step.
- 2026-10-07: Published [cutano/kanji-study-web](https://hub.docker.com/r/cutano/kanji-study-web) on Docker Hub with `linux/amd64` and `linux/arm64` variants and `0.2.0`, `sha-f093b7b`, and `latest` tags. Both container variants passed static serving and content digest checks; Chromium and WebKit passed cold offline acceptance against the arm64 container. See `release-report.md` and the prebuilt-image instructions in `deployment.md`.
- 2026-10-07: Aligned the topbar search field with Library search: rounded surface and border, shared sage focus outline on the full control, and no inner yellow rectangle. See the topbar search follow-up in `release-report.md`.
