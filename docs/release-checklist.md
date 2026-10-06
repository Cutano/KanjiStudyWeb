# Release Checklist

Verification date: 2026-10-07. See [release report](release-report.md) for commits, exact commands, outcomes, browser versions, and limitations. An unchecked item means not verified, not implicitly passed; physical-device and deployment checks require the corresponding hardware or public hostname.

## Automated Application Checks

- [x] `npm ci` succeeds from the lockfile on Node 24.
- [x] `npm run data:prepare` verifies both input hashes and emits the complete content manifest.
- [x] Catalog counts and source-statistics removal pass their checks.
- [x] `npm test` passes, including profile rollback, import validation, review scheduling, query/parsing, and writing geometry.
- [x] `npm run build` passes strict TypeScript and produces every offline shell dependency.
- [x] Browser acceptance passes against production assets, including a real full-catalog offline reload.
- [x] Backup restore reproduces personal state, including extensions and resumable sessions.
- [x] Interrupted downloads and corrupt resources do not leave a false ready state.
- [x] A two-release update test preserves saved study state and coherent offline assets.

## Container and Hosting Checks

- [x] `docker compose build` succeeds from source with generated host output excluded.
- [x] `docker compose up -d` runs the unprivileged read-only container and becomes healthy.
- [x] `/healthz`, HTML, manifest, icons, worker, Wasm, and catalog asset requests return correct content.
- [x] Fixed-name entry resources revalidate; only fingerprinted filenames receive immutable caching.
- [x] Missing `.wasm`, `.js`, and `/data/` resources return 404 rather than HTML.
- [x] A browser served by Nginx has no required-resource CSP failures.
- [ ] The deployed HTTPS hostname is stable and the manifest/service worker scope matches it.
- [x] The deployment contains required attribution and license notices.

## Mobile and Interaction Checks

- [x] Narrow phone, tablet, and desktop layouts have no clipped primary actions or horizontal overflow.
- [x] Light/dark themes, larger text, reduced motion, keyboard focus, and dialog navigation work.
- [x] Android Home Screen initialization and an unreachable-origin cold process launch pass on the recorded emulator/browser version. Global airplane mode was not used.
- [ ] iOS Home Screen initialization and cold airplane-mode launch pass on a recorded device/OS version.
- [x] Full-catalog startup and repeated navigation pass on the approximately 4 GB Android emulator; measured process memory and limits are recorded in the Android report.
- [x] Android touch writing, touch cancellation, stroke feedback, and portrait/landscape layouts pass; additional stroke/hint behavior is covered in browser tests.
- [x] Available recordings play offline from locally installed resources.
- [x] Progress persists after a second offline process restart. Prolonged OS suspension and storage eviction remain unverified.

## Scope and Delivery

- [x] Every accepted core feature has evidence in the requirements/parity matrix.
- [x] Unavailable original add-on content is represented by the documented user-supplied extension workflow.
- [x] Any untested device case or unresolved source limitation is stated explicitly.
- [x] Runtime has no application backend, telemetry, external font, CDN, or network dependency after initialization.
- [x] Source changes are committed with focused descriptions; AGENTS.md remains unchanged unless explicitly authorized.

See [testing strategy](testing.md), [architecture](architecture.md), and [deployment instructions](deployment.md) for detailed acceptance procedures.
