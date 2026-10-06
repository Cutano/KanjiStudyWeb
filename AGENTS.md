# Repository Instructions

## Protected document

**Do not modify this AGENTS.md during subsequent development unless the user explicitly requests that this file be changed.** This restriction includes autonomous agents, refactors, maintenance tasks, and automated formatting. Put evolving plans, decisions, and verification evidence in `docs/` instead.

## Product and scope

Kanji Study Web is an independent, offline-first PWA implementing the observed core workflows of the Android Kanji Study reference. See `docs/requirements.md`, `docs/research/`, and `docs/project-plan.md`. The user approved completing all core features and allowing later import of KLC/Outlier extensions. Do not invent missing extension content or bypass purchase controls.

## Architecture

- React and strict TypeScript with Vite; responsive, accessible UI.
- Static Docker deployment without a traditional application backend.
- Immutable SQLite reference catalog queried in a dedicated Web Worker through a typed repository. No SQL in UI components.
- IndexedDB for user-owned progress, sets, notes, settings, and imported extensions; catalog and profile lifecycles remain separate.
- Versioned, verified offline resource installation. Never declare offline readiness before all required resources are durably available.
- All production fonts, scripts, styles, dictionary data, and required media are locally hosted. No runtime CDN requirement.

## Data ownership and licensing

- Never modify `Resource/kanji.db`. Build a derived catalog reproducibly, excluding original analytics and mistakes from the new user's profile.
- Preserve Unicode code points, table-domain identity, source ordering, reading variants, and documented missing-data behavior.
- Code is LGPL-3.0-or-later. Third-party data retains its own license; keep source provenance and attributions separate.
- Never commit secrets, personal backups, original APKs, generated bundles, or downloaded audio archives.

## Engineering workflow

- Maintain readable, cohesive modules and explicit typed contracts. Prefer architecture that prevents invalid state to scattered defensive checks.
- Use Git with focused, descriptive commits. Do not overwrite unrelated user or agent changes.
- Coordinate file ownership when parallel agents work in the shared checkout.
- Keep engineering documents in English. Record verified behavior separately from assumptions and platform limitations.
- Do not add unrelated features, dependencies, abstractions, or speculative compatibility layers.

## Verification

- Run TypeScript checks, production build, and relevant automated tests before committing functional milestones.
- Test parser edge cases, scheduling, persistence/backup validation, query behavior, and handwriting geometry at appropriate boundaries.
- Browser acceptance tests must exercise real bundled data and production service-worker offline reload, not only mocked fetches.
- Inspect desktop and narrow mobile layouts for clipping, contrast, touch targets, keyboard access, and useful empty/error states.
- Keep actual-device iOS installation and memory checks distinct from automated WebKit simulation. Do not claim tests that were not run.
- Preserve user progress during app/cache upgrades and interrupted downloads. Imports validate before a transactional write.

## Communication and completion

- Continue authorized work autonomously. Notify the user of concrete blockers or when available Codex usage falls below 2%.
- Update `docs/project-plan.md` and release evidence as requirements are fulfilled.
- Claim completion only against the agreed scope and verified acceptance criteria.
