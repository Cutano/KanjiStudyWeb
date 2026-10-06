# Architecture and Technical Decisions

Status: implementation baseline. Research date: 2026-10-07.

This document defines the intended system and its acceptance constraints. It does not claim that every described capability has already been implemented or tested. Feature evidence and delivery status belong in the requirements and project tracking documents.

## 1. Product Constraints

- A static, installable PWA named **Kanji Study Web** runs on Android, iOS, and desktop browsers.
- After initialization in the installation being used, every delivered study capability must work without a network connection.
- No application backend, account service, remote database, telemetry service, or runtime CDN is required.
- Docker serves the same static build that can be hosted by any suitable HTTPS static host.
- Preserve the original application's observable learning behavior where evidenced. Web navigation, responsive layouts, keyboard access, and explicit download controls may improve its interaction model.
- Keep source content separate from personal learning records. A content update must never replace a learner's progress.
- Project code uses LGPL. Dataset and dependency provenance must be recorded separately; a project license does not establish ownership of supplied content.

## 2. Decisions

| Area | Decision | Rationale and constraint |
| --- | --- | --- |
| Application | React, TypeScript, Vite | Typed domain contracts, reusable accessible components, and a static production output without a server runtime. Pin dependencies with a lockfile. |
| Styling | Local CSS design tokens and reusable components | A consistent responsive design without introducing a large UI abstraction solely for basic controls. Icons and fonts must be local assets or system resources. |
| Catalog queries | `sql.js` in a dedicated Web Worker | Reuses the relational source and indexes, preserves associations, and isolates CPU work from interaction. The catalog is immutable at runtime. |
| Personal storage | IndexedDB through a small typed repository (`idb` is appropriate) | Transactional local persistence independent of replaceable catalog assets. |
| Offline shell | Service worker and versioned Cache Storage | Offline navigation and all app assets, including worker code and WebAssembly, are installed as a coherent release. |
| Catalog installation | Foreground, verified download managed separately from shell installation | A large catalog must not make the service worker's installation an opaque, long-running download. Show progress and recover from interruption. |
| Domain logic | Pure TypeScript modules | Scheduling, filtering, scoring, template parsing, and import validation can be tested without React or a browser. |
| Rendering strokes | SVG reference paths and Pointer Events | Resolution independent animation; mouse, pen, and touch share one input model. |
| Hosting | Multi-stage Docker build, static Nginx runtime | No database daemon, application process, writable server state, or runtime secrets. |
| Verification | Vitest, repository integration tests, Playwright, installed-device checks | Exercise both deterministic logic and actual service worker, storage, and mobile behavior. |

Vite's production build is intended for static hosting; its preview server is a local verification tool, not the production server. [Vite deployment documentation](https://vite.dev/guide/static-deploy.html)

### 2.1 Catalog Storage Alternatives

The source database is 98,181,120 bytes (93.633 MiB), before a distributable copy removes historical learner statistics. `sql.js` uses an in-memory database. A worker avoids main-thread blocking but does **not** remove the cost of loading the file and constructing SQLite's memory representation. Avoid retaining an extra ArrayBuffer in React state, transfer buffers to the worker, and measure actual memory behavior on supported mobile hardware. [sql.js project documentation](https://github.com/sql-js/sql.js)

| Alternative | Disposition |
| --- | --- |
| SQL.js + cached immutable database | Selected baseline. Simple, established query behavior; requires a real mobile memory and cold-start gate. |
| Official SQLite Wasm + OPFS | Preferred next adapter if baseline memory is unacceptable. It can use persistent files, but VFS choice affects locking, multi-tab support, browser compatibility, and hosting headers. Do not implement two engines before evidence requires it. |
| Entire catalog converted to IndexedDB rows | Rejected baseline. Duplicates relational query and migration logic, creates a lengthy import, and makes link-heavy dictionary features harder to maintain. |
| Large JSON bundle in the main thread | Rejected. Expensive parse and memory use; no suitable relational indexes. |
| HTTP range requests without a full local copy | Rejected for offline readiness. A page cache is insufficient when an unseen lookup must work offline. |

SQLite's documentation distinguishes the OPFS VFS (which needs cross-origin isolation headers) from the access-handle pool VFS, with different concurrency tradeoffs. These constraints should be revisited only if replacing the selected repository adapter. [SQLite Wasm persistence documentation](https://sqlite.org/wasm/doc/tip/persistence.md)

## 3. Boundaries and Data Flow

```text
React presentation and navigation
    | typed requests                      | learner actions
    v                                     v
Catalog repository client           Study/session domain services
    | request IDs + worker messages       | transactions
    v                                     v
Dedicated catalog worker            Personal data repository
    | SQL.js                              | IndexedDB
    v                                     v
Immutable catalog                    Progress, groups, settings,
                                     notes, reviews, sessions

Offline installation service -> verified catalog cache + manifest
Service worker -> coherent shell cache + offline navigation
```

Dependencies point inward: views use services; services use repository interfaces; catalog parsing and study rules do not import React. Database column names and encoded source strings stay behind the catalog repository. The service worker handles fetch lifecycle, not live study state or long-running SQL work.

Suggested responsibility layout (adapt file names to the implementation without duplicating responsibilities):

```text
src/app/          boot, navigation, providers, layout
src/components/   shared controls and presentation primitives
src/features/     browse, search, detail, study, groups, statistics, settings
src/domain/       identities, study rules, scoring, parsers, selectors
src/data/         catalog contracts, worker, SQL queries, personal repository
src/offline/      download state, verification, service worker integration
scripts/          deterministic catalog and release asset preparation
tests/            integration and browser acceptance tests
```

### 3.1 Repository Contract

The catalog API provides bounded operations such as `listCharacters`, `getCharacter`, `searchCatalog`, `getVocabulary`, `getSentences`, `getNames`, and `getStudyList`. Requests carry typed inputs and an ID. Worker responses carry the same ID and typed results or a structured error. UI components do not send arbitrary SQL strings.

- Bind all values in SQL. Sort columns and classification names come from code-owned allowlists.
- Return only needed fields and a bounded page. Use stable ordering for pagination.
- Group repeated vocabulary associations by entry when displaying entries; retain reading variants when displaying reading examples.
- Debounce text search and discard stale responses. SQL.js queries are synchronous within the worker: abandoning a promise does not cancel a query already running. Coalesce queued searches instead of accumulating them.
- Start with measured indexed/exact/prefix query paths and bounded substring matching. Add a build-time search index only if representative searches miss the performance budget. Record tokenizer and normalization behavior when adding one.
- Close prepared statements after use. Keep one catalog connection per application instance and do not expose it to presentation code.

## 4. Catalog Build and Source Semantics

The supplied database is an input artifact; do not modify it in place. Its hash and detailed schema are documented in [the supplied database reference](../Resource/kanji_database.md).

The reproducible content build must:

1. Open the source read-only and verify the expected schema, source hash, and integrity.
2. Produce a separate distributable database. Remove source `analytics`, `quiz_mistake`, and `draw_mistake` records so new installations never inherit another learner's history. Retain required schema only if the repository needs it.
3. Retain every content record and relationship used by supported capabilities. Add only documented deterministic indexes or derived search fields.
4. Run content checks, vacuum the distributable where appropriate, and calculate its byte length and SHA-256.
5. Emit a manifest containing catalog format version, content version, immutable asset URL, byte length, SHA-256, and expected entity counts.
6. Copy all runtime assets into the static output; use no remote font, icon, Wasm, or library URLs.

### 4.1 Identity and Parsing Rules

| Source property | Required handling |
| --- | --- |
| Character `code` | Unicode code point. Use `String.fromCodePoint`, not `fromCharCode`; preserve supplementary-plane characters. |
| Kanji/radical overlap | Identity includes kind, for example `kanji:23398` or `radical:23398`; a code alone is not globally unique. |
| Vocabulary, name, sentence IDs | Stable record identifiers, not character codes. Gaps are valid. |
| Twelve classification systems | Use the stored level and sequence pair, including original/revised variants. Zero means unclassified where documented. Do not silently relabel one system as another. |
| Readings and templates | Parse into typed text/annotation tokens and render as text nodes. Never interpret source content as HTML. Preserve meaningful okurigana boundaries and annotations. |
| Sentence annotations | Parse ruby markup and construct plain-text span positions separately. Do not apply vocabulary offsets to the raw annotated string. |
| Missing component catalog entries | Keep associations with left joins; show available code point and fallback text. Private-use glyphs require an explicit display fallback. |
| Missing stroke paths | Show meaning/readings and allow applicable study modes; explain unavailable guided strokes and do not fabricate grading. |
| Source learning aggregates | Excluded from fresh-user state. Documented source units and unusual scores are not the definition of new application metrics. |

There are 628 kanji without stroke paths. The database also contains 8,132 vocabulary audio **resource identifiers**, but no audio binary files or complete resource URLs. These are input limitations, not proof that audio or every writing exercise can run offline. [Database reference](../Resource/kanji_database.md)

### 4.2 Audio and Other External Features

If audio is part of the accepted feature inventory, provide an explicit offline audio adapter using bundled, appropriately sourced recordings or a bundled local synthesis model. Include its resources in initialization, size estimates, manifests, and offline tests. Browser `speechSynthesis` may be offered when available, but device voice availability and offline behavior must be verified before it counts as offline parity. A label or enabled play button without functioning local playback is not completion.

External dictionary links, app-store purchase flows, remote synchronization, and similar platform-specific behavior must be recorded in the parity matrix with the actual web adaptation. Opening a third-party website is never part of the guaranteed offline surface.

## 5. Offline Installation and Updates

### 5.1 Readiness State Machine

```text
checking -> not-installed -> downloading -> verifying -> ready
                    ^             |              |
                    +--- retryable error <-------+

ready -> downloading-new-version -> verifying -> ready-new-version
  |             failure or interruption              |
  +--------------- remain usable --------------------+
```

“Ready offline” requires all of the following, not just a successful HTTP response:

- A service worker controls the application and its complete required shell assets are cached.
- The required content asset exists locally and matches the release manifest.
- SQLite opens it successfully and representative catalog queries return expected results.
- IndexedDB opens and commits a small test or initialization transaction.
- Any required auxiliary media/model pack is locally present and verified.

Persist readiness metadata only after validation; verify the actual cached resource on startup so stale metadata does not falsely claim readiness after eviction or partial cleanup. Do not reset personal state when repairing content.

### 5.2 Download Protocol

1. Inspect estimated storage and display required download size. Estimates are advisory; handle a real quota failure even after a positive estimate.
2. Download in a foreground task with visible bytes/progress and cancellation. Use the manifest's expected decoded byte count, not an HTTP compressed transfer length, for content verification.
3. Stage under a version-specific key, calculate SHA-256, and reject a mismatch, truncated file, failed response, or incompatible schema. Never replace the ready catalog with an unverified response.
4. Store the verified artifact and only then commit the ready version pointer. Cache Storage and IndexedDB do not form one cross-API transaction, so startup must reconcile metadata against actual files.
5. If interruption occurs, discard an incomplete staged object and allow retry. Do not claim resume support unless chunk/range persistence is actually implemented and tested.
6. Retain the last working catalog through the transition. Cleanup may remove obsolete catalog assets after the new version is confirmed usable, never personal stores.

Avoid buffering multiple copies of the catalog merely to display progress. A whole-buffer digest may still be acceptable for the baseline but must be measured with the SQLite initialization peak; streaming hash or chunked artifacts are options if that gate fails.

### 5.3 Shell and Content Versioning

- Fingerprint app assets and use a release-specific shell cache. Every lazy route chunk and runtime dependency needed offline must be in the shell asset manifest, whether or not the user has visited that route.
- Serve navigation from the installed release's cached HTML so HTML and assets remain coherent. Network failures must not fall through to an unavailable server.
- Version content independently from shell releases. The app declares which content format versions it can read.
- Announce an available update and activate it at a safe point after study answers and the session checkpoint are saved. Do not reload an active writing or quiz session automatically.
- Keep service worker caching scoped to the application; do not delete unrelated caches on the origin.
- A failed new service worker install leaves the previous working release intact.

Service workers have an event-driven, interruptible lifetime; they are not persistent application processes. Their update lifecycle and cache API make coherent offline releases possible, but correctness remains application logic. [Service Workers specification](https://w3c.github.io/ServiceWorker/)

### 5.4 Installation and Browser Storage

Use a manifest with stable `id`, app name, short name, icons including a maskable icon, `start_url`, `scope`, theme/background colors, and standalone display. Layout uses safe-area insets and supports reduced motion. Android may expose an install prompt; iOS instructions must explain Add to Home Screen and launch from that icon before initialization.

WebKit documents a separate installed-app storage transition: cookies can be copied when adding to the Home Screen, but other local storage is not copied. Therefore, do not assume a database downloaded in Safari already exists inside a newly installed app. [WebKit 17.2 release notes](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)

Request persistent storage where available and expose its actual result. Storage can still be cleared by the user; best-effort storage may be evicted. Offer portable backups, retain progress independently during content repair, and explain recovery in storage settings. WebKit's quotas are policy-dependent and estimates are not reserved capacity. [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)

HTTPS is required in deployment. A phone loading an ordinary LAN HTTP address does not receive the localhost secure-context exception. The Docker container may serve HTTP behind a TLS reverse proxy; document this distinction in deployment instructions.

## 6. Personal Data and Study State

Use a versioned IndexedDB schema. Suggested stores/responsibilities are:

| Store | Durable data |
| --- | --- |
| Settings | Theme, study display options, selected classification, daily goal, accessibility preferences. |
| Character progress | Kind-qualified character ID, learning status, review schedule, quiz and writing aggregates. |
| Groups | User groups, membership ordering, names, and study configuration. |
| Customizations | Notes, custom meanings/readings, and pinned examples, separate from immutable source. |
| Review events | Stable event ID, timestamp, local calendar day, mode, result, duration in documented milliseconds, and source session. |
| Session checkpoints | Configured queue, current position, completed responses, and resumable mode state. |
| Metadata | Schema version, current catalog version, import/export metadata, and readiness records. |

The actual schema may combine small stores where transactions and lookup patterns justify it. Avoid a generic untyped key/value blob for all application state.

An answer operation commits the event, progress change, and session advancement in one transaction. Event IDs make repeated submission idempotent. Calculate aggregates from the same domain reducer used for new reviews, and use persisted events/checkpoints for recovery. Do not wait for `beforeunload` to save progress.

When multiple tabs are open, write through IndexedDB transactions and notify other tabs of committed changes (for example with `BroadcastChannel`). Handle a blocked schema upgrade with a clear reload instruction. Never overwrite another tab's updates by writing an old full-state snapshot.

IndexedDB transactions are the persistence boundary; schema upgrades and version changes require explicit handling. [Indexed Database API specification](https://w3c.github.io/IndexedDB/)

### 6.1 Backup and Restore

- Export a versioned JSON document containing project identifier, schema version, export time, content version, settings, customizations, groups, progress, and review/session records.
- Do not include the large immutable catalog in ordinary progress backups.
- Validate structure, size, scalar ranges, IDs, and supported schema before opening a write transaction. Parse imported text as data only.
- Present a preview of record counts and the declared restore behavior. For replace, commit the validated result atomically; for merge, document stable ID and conflict rules and test them.
- A failed import leaves existing data unchanged. Offer a backup before destructive replacement or reset.
- Do not claim compatibility with original Android backup files unless their format has been inspected and a fixture has passed a round trip.

## 7. Learning Engines

### 7.1 Shared Session Model

Flashcards, recognition quizzes, reading/meaning recall, and writing use an explicit session state machine. A session is built from a frozen list of kind-qualified IDs and configuration. Selection rules support catalog groups, custom groups, progress filters, due reviews, and mistake-focused review as required by the observed product.

Use a seeded shuffle for deterministic tests. Distractors must be distinct, valid for the prompt type, and not semantically equivalent answers. Persist the displayed prompt and answer before advancing; restoring a session must not silently reshuffle it. Separate result calculation from presentation and from persistence.

Review scheduling must have named, documented rules and a version. Do not represent a newly chosen algorithm as the original app's algorithm without evidence. Use injected clocks in tests, record UTC timestamps plus the intended local day, and define day-boundary behavior consistently for streaks and daily goals.

### 7.2 Writing and Stroke Animation

- Parse ordered path segments from the content repository and render at their native coordinate system inside a responsive view box.
- Pointer capture keeps a stroke continuous outside the pad; convert CSS coordinates into the reference view box. Ignore other simultaneous pointers while one stroke is active. Suppress page panning only inside the writing surface.
- Resample user and reference polylines to comparable point counts. Compare position, shape, start/end location, direction, and relative length. Ordered alignment (such as dynamic time warping) may tolerate reasonable drawing speed and sampling differences.
- Preserve the character coordinate system: normalizing every individual stroke to its own bounding box would accept strokes in the wrong location or size.
- Direction and stroke-order checks must reject a reversed or misplaced stroke even when its shape is similar. Tolerance may vary by exercise mode; calibration must use representative human traces.
- Provide explicit hint, trace, undo, clear, replay, skip, and self-assessment behavior as required. Never label an exercise graded if it only counted pointer strokes.
- Characters without reference geometry receive an honest unavailable state or an explicitly labeled ungraded practice mode.

## 8. Static Deployment

Build dependencies and the catalog in a builder stage; copy only production static output into a minimal runtime image. Nginx serves the application, Wasm with the correct MIME type, icons, manifest, and immutable catalog assets. No writable volume is needed to keep user data because user data belongs to each browser installation.

Use cache-control appropriate to content: revalidate HTML, manifest, and service-worker entry points; immutable long-lived caching for fingerprinted assets and content-addressed database files. Restrict SPA fallback to navigation paths, so a missing `.wasm` or database returns a failure instead of HTML with HTTP 200. Include a health check that verifies a small static resource.

Serve a restrictive content security policy compatible with bundled WebAssembly, local workers, and local assets. Do not include third-party scripts. Any future external integration must be optional and must not become a prerequisite for offline startup.

## 9. Release Risks and Evidence Gates

| Risk | Required evidence or mitigation |
| --- | --- |
| SQL.js catalog peak memory on mobile | Measured initialization, repeated search, and session stability on representative Android and iOS devices. Switch the repository adapter if baseline is unsuitable. |
| Missing original media or feature data | Trace every observed original feature to locally available resources; record gaps explicitly rather than adding nonfunctional controls. |
| iOS installation/storage differences | Real Home Screen launch, initialization, airplane-mode restart, and durable progress verification. Desktop WebKit alone is insufficient. |
| Interrupted or corrupt content update | Fault-injection test leaves the current ready version and progress usable. |
| Stale service worker assets | Upgrade test with two build versions, an open session, and subsequent offline restart. |
| Quota failure or eviction | Clear recovery UI; initialization never claims ready; imported/exported progress remains independently testable. |
| Source encoding ambiguities | Golden examples and a full-catalog parser scan; distinguish inferred conventions from proven ones. |
| Original app behavior not observed | Mark unknowns in the requirements matrix and inspect them before claiming complete parity. |

See [testing strategy](testing.md) for concrete acceptance cases and required evidence.
