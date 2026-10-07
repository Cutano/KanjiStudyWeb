# Dictionary Parity Follow-up — 0.1.1

## Scope

The user reported four gaps in the initial core release: search ordering, inline part-of-speech labels, flattened senses, and missing pitch diagrams and standalone sentence pages. This follow-up addresses those workflows using the supplied catalog and fresh observations of Android Kanji Study 7.8.2.

## Reference findings and implementation

### Search order

Exact written-form or full-reading matches are promoted first. The remaining ordering is JLPT N5 through N1, ungraded entries, descending number of linked examples, and common-word status. Reading and record ID provide deterministic ties. The same ordering is used for vocabulary associated with a character.

Native searches for `学`, `今日`, and English `school` distinguish these rules: exact N3 学 precedes N5 学校, while N5 教室 precedes N4 教育 despite having fewer examples. The supplied database's search index includes JLPT, sentence count, and commonness. This is a reconstruction from observed behavior, not access to the original search implementation.

The original example-count badge combines ordinary sentences and graded-reading exercises. It is not a corpus-frequency rank. The supplied snapshot has zeroed count fields and does not contain the locked graded-reading corpus, so the web app counts distinct available sentence links. This preserves the verified ranking hierarchy but cannot reproduce every tie from the newer original database. It does not fabricate missing exercise counts.

### Structured definitions

A shared renderer presents part-of-speech labels on a separate, muted blue line and numbers distinct senses. Labels repeat when the part-of-speech group changes. Qualifiers and references retain their position within each sense. The template defines sense boundaries: 上 has 12 senses across 15 gloss slots, so splitting only on a raw gloss separator would be incorrect. Inline fragments such as `Ivy League (clothing) style` remain a single sentence in the correct order.

The parser supports inherited part-of-speech groups, nested annotations, field labels, and numeric annotations such as historical years. A full-catalog test verifies that all 214,894 vocabulary entries retain every gloss in source order, both in provenance fields and the displayed content sequence. Search results, character vocabulary, favorites, and sentence vocabulary share the renderer. Form and pronunciation labels identify special readings and outdated spellings without applying one reading's flags to another.

### Pitch diagrams

Each pronunciation retains its own accent variants. SVG diagrams show one filled dot per mora and a hollow following-particle dot, preserving the distinction between an unaccented word and a word accented on its final mora. Small contracted kana share a mora; っ, ん, and long-vowel marks retain their own positions. Accessible descriptions state the reading, accent, and high/low sequence.

漢字 shows accent 0: か low, ん and じ high, with a high following particle. 上 demonstrates separate accent-0 and accent-2 patterns. Missing or unsupported pitch data does not produce a guessed graph.

### Standalone examples

Example previews open `#sentence/<id>` from word details, character details, favorites, and catalog reading. The page includes ruby, translation, linked vocabulary in sentence order, constituent kanji, furigana and word-separation controls, favorites, reading progress, copy, optional installed device speech, and persistent notes. Source links recognize inflected forms such as 書き取り while opening the dictionary entry 書き取る.

These routes use the existing offline catalog and profile stores. No backend, external runtime request, catalog rebuild, or profile migration is needed. Updating the app keeps existing learning data.

## Verification

- Prettier, TypeScript, and production build passed.
- 69 unit/integration tests passed, including full-catalog gloss preservation, inline qualifier ordering, ranking examples, pitch patterns, and sentence associations.
- All 28 production browser cases passed in the complete regression run (14 Chromium desktop and 14 mobile WebKit; 2.4 minutes, no retries). The six new cases cover ordering, grouped senses, mora and particle pitch, sentence navigation, keyboard access, offline reload, durable notes/favorites/read status, and light/dark accessibility. Existing study, catalog, backup, collections, and update regression cases also passed. After the final inline-qualifier and spelling-label corrections, all six dictionary cases passed again with expanded assertions and accessibility coverage (43.4 seconds, no retries).
- Final browser command: `npx playwright test --reporter=list --output=test-results/final-0.1.1`.
- Final targeted command: `npx playwright test tests/e2e/dictionary.spec.ts --reporter=list --output=test-results/dictionary-inline-final`.
- Docker rebuilt and restarted successfully. `node scripts/verify-static-host.mjs` verified the app shell, icons, Wasm, all nine content assets, cache headers, CSP, and missing-resource behavior at `http://127.0.0.1:8080`.
- Desktop and 390-pixel mobile screenshots were inspected for definition grouping, pitch geometry, ruby, sentence links, and layout overflow.
- The existing Android Home Screen installation applied the final update through its visible banner. The complete persisted profile was identical before and after, including all four prior review events. Native-touch navigation verified the 漢字 diagram, standalone sentence 2381, and the link back to 漢字. See the [Android follow-up](android-verification.md#version-011-update-follow-up--2026-10-07).

An intermediate WebKit initialization correctly rejected an audio response whose bytes differed from its manifest hash. The trace confirmed corrupted transferred bytes despite a successful HTTP status; the same isolated case passed on a fresh run. No integrity check was weakened and no application defect was inferred from that transient transfer.

## Evidence

- [Original-app observations](research/original-app.md#dictionary-follow-up--2026-10-07)
- [Data audit](research/data-audit.md)
- [Browser acceptance specification](../tests/e2e/dictionary.spec.ts)
- [Pitch and word detail](screenshots/dictionary-kanji.png)
- [Separate senses](screenshots/dictionary-senses.png)
- [Sentence detail](screenshots/sentence-detail.png)
- [Mobile sentence detail](screenshots/sentence-mobile.png)

Physical iOS Home Screen testing remains outside the available equipment. Mobile WebKit automation is recorded separately from actual iOS acceptance.
