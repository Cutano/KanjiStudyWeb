# Kanji Study Web

An independent, offline-first Japanese study PWA. Explore the complete supplied kanji dictionary, practice recall and handwriting, build collections, and keep a daily learning habit. The application runs entirely in the browser; Docker serves static files only.

## Run locally

Requirements: Node.js 24 or newer. The first data preparation downloads the pinned, licensed Kanji alive audio archive (about 124 MiB).

```sh
npm ci
npm run data:prepare
npm run dev
```

Development mode is for editing. To verify installation and offline behavior, use the production build:

```sh
npm run build
npm run preview
```

Open `http://localhost:4173`. Select **Download & start learning** to verify and save the complete library. After initialization, the app shell, dictionary, examples, and recorded audio are available offline.

## Deploy with Docker

```sh
docker compose up --build -d
```

Open `http://localhost:8080`. Use HTTPS at your reverse proxy when serving a phone or another computer; ordinary HTTP on a LAN address cannot install the service worker. See [deployment instructions](docs/deployment.md) for ports, headers, storage, updates, and container verification.

On iPhone and iPad, use Safari → Share → Add to Home Screen, then open the installed app and initialize its library. Browser and installed-app storage can be separate. On Android, use the browser's Install app action. No account or server-side profile is needed.

## What's included

- **Complete supplied catalog:** 7,045 kanji, 148 kana, 265 radicals, 214,894 words, 87,950 names, and 16,277 annotated sentences.
- **Twelve study sequences:** Japanese school grades, JLPT, Remembering the Kanji, Kanji Kentei, Kanji Learner's Course, frequency, Hadamitzky, and Kanji in Context, including the supplied revisions.
- **Reference tools:** text/reading/romaji search, combined filters, components, stroke counts, animated stroke order, examples, related entries, and additional-language readings.
- **Study:** flashcards, multiple-choice quizzes, geometric handwriting feedback, self-assessment, contextual reading, repeat mistakes, and saved sessions.
- **Guided review:** transparent local spaced repetition, daily new-character limits, familiarity ratings, goals, streaks, activity, and character rankings.
- **Personal library:** favorites, notes, custom meanings/readings, ordered sets, text import, and CSV/Anki export.
- **Offline audio:** all 8,132 native vocabulary recordings referenced by the supplied database, packaged into verified local shards. Optional device speech selects only local Japanese voices.
- **Your data:** transactional IndexedDB storage, full JSON backup/restore, and validated extension import. No source learning statistics are copied into a new profile.
- **Responsive design:** light/dark/device themes, keyboard navigation, touch writing, reduced-motion support, and a home-screen manifest.

The user-approved scope includes all core workflows and later import of authorized extensions. Locked original KLC reading sets and Outlier explanations are not bundled. [Extension format and examples](docs/extensions.md) describe how to import compatible content.

## Engineering

```sh
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:e2e
```

Tests exercise source-derived data, text parsers, schedules, persistence, backup/extension validation, installation integrity, stroke geometry, and production browser flows. Browser tests download the actual local data package and reopen a fresh page offline. The release passes 62 unit/integration tests and 22 production browser cases. Android emulator testing also verifies installation, an unreachable-origin cold process launch, all four study modes, native audio, and persistence after restart. See [test strategy](docs/testing.md), [release evidence](docs/release-report.md), and [Android verification](docs/android-verification.md).

| Directory         | Responsibility                                                                    |
| ----------------- | --------------------------------------------------------------------------------- |
| `src/data/`       | Read-only SQLite worker, typed queries, verified catalog installer, text decoding |
| `src/domain/`     | Domain types, review scheduling, event recording, statistics                      |
| `src/state/`      | User profile transactions, validation, reactive subscriptions                     |
| `src/features/`   | Library, details, collections, reading, progress, settings, study workflows       |
| `src/components/` | Shared accessible UI and stroke rendering/input                                   |
| `scripts/`        | Reproducible data, icon, attribution, and deployment tools                        |
| `tests/e2e/`      | Actual production Chromium and mobile WebKit acceptance tests                     |
| `Resource/`       | Immutable user-supplied database and its schema reference                         |
| `docs/`           | Requirements, research, architecture, testing, deployment, and release evidence   |

Read [AGENTS.md](AGENTS.md) before development. It is protected: do not change it unless the user explicitly asks.

## Data and platform boundaries

- The source has no stroke paths for 628 kanji. Their glyphs remain browsable and self-assessed writing remains available; automatic stroke grading requires paths.
- Native audio covers the 8,132 recorded words, not every dictionary word or sentence. Optional Japanese device voices depend on installed operating-system voices and browser support.
- A static, offline app cannot reliably schedule a background notification on every mobile OS. Export a recurring calendar reminder from Settings instead.
- Browser storage may be evicted or deleted by the device. Request persistent storage and keep exported backups.
- Desktop WebKit automation is useful compatibility evidence, not a substitute for physical iOS device testing. Exact Android proprietary scoring/scheduling algorithms are not claimed.

## License and attribution

Original project code is **LGPL-3.0-or-later**; see [LICENSE](LICENSE) and [COPYING](COPYING). Third-party datasets and media retain their own licenses. The supplied database is user-provided reference material and its snapshot lacks complete upstream release metadata. Observed original-app credits and independently verified media sources are recorded in the [data audit](docs/research/data-audit.md).

The installed app includes offline license and attribution files under `public/licenses/`, accessible in Settings. This project is not affiliated with or endorsed by the original Kanji Study Android developer.
