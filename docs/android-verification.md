# Android Installed-App Verification

## Tested environment

- Date: 2026-10-07, approximately 02:43–02:50 CST.
- User-provided Android emulator `emulator-5554`, model `sdk_gphone16k_arm64`, ARM64, Android 17 / API 37, build `CP41.260831.007` (`16416850`), approximately 4 GB RAM reported by Android (`4,061,984 KiB`). This is an Android runtime test, not a physical-device test.
- Chrome `149.0.7827.5`, version code `782700532`. Its reduced web user-agent reports Android 10 / Chrome 149.0.0.0; the installed package and OS properties establish the actual versions above.
- Docker release image `d2eea32681bd`, served at `http://localhost:8080` through `adb reverse tcp:8080 tcp:8080`. Shell cache: `kanji-shell-7104588003179bf0`.
- Portrait web viewport: 448 × 920 CSS pixels in the installed app, device pixel ratio 3; native screenshot: 1344 × 2992 pixels. The ordinary browser viewport was 448 × 888.
- Chrome's native installation prompt created WebAPK `org.chromium.webapk.a47ba7b29f2152a51_v2`. Home-screen launch returned `matchMedia('(display-mode: standalone)').matches === true` and had no browser address bar.

## Results

| Check                    | Evidence and result                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full initialization      | Downloaded and verified the real catalog/audio bundle in approximately 5.8 seconds over the local ADB connection. Ready screen, controlling service worker, and both shell/reference caches were present. No JavaScript errors were observed during initialization.                                                                                                               |
| Durable assets           | Origin storage used approximately 150.7 MB after initialization and 151.1 MB after cold start. `navigator.storage.persisted()` returned false: this browser granted standard storage, not durable-storage protection.                                                                                                                                                             |
| Home-screen installation | Native Chrome install prompt succeeded; a distinct application icon appeared next to the original Android app. Installed WebAPK launched in standalone mode.                                                                                                                                                                                                                      |
| Offline cold launch      | Removed the ADB reverse mapping, force-stopped both Chrome and the WebAPK, then tapped the home-screen icon. The complete home screen became ready in approximately 3.38 seconds. A fresh uncached `fetch` failed, while the app loaded through its service worker. This proves an unreachable-origin cold start with a new browser process, not just an already-loaded database. |
| Flashcards and quiz      | Completed a flashcard and a sentence-gap quiz for 学 offline; both committed a correct review event.                                                                                                                                                                                                                                                                              |
| Touch writing            | Chrome DevTools touch input generated actual Android touch/pointer events for 一. Ordered stroke evaluation accepted the trace. A separate `touchCancel` left zero strokes, zero pending strokes, and no phantom input.                                                                                                                                                           |
| Reading                  | Displayed ruby, revealed translation, and marked a supplied sentence understood offline.                                                                                                                                                                                                                                                                                          |
| Complete dictionary      | The offline dictionary displayed its full 214,894-entry count and opened 学校 details.                                                                                                                                                                                                                                                                                            |
| Native audio             | The bundled 学校 MP3 decoded to 1.062 seconds and emitted the media `playing` event with the origin unreachable. No device speech synthesis was substituted.                                                                                                                                                                                                                      |
| Settings                 | Furigana toggled both ways and was observed after the IndexedDB commit.                                                                                                                                                                                                                                                                                                           |
| Second process restart   | Force-stopped Chrome and the WebAPK again while the origin remained unreachable. Home-screen launch restored exactly four review events, one for each study mode; one read sentence; one correct writing result; furigana enabled; and no unfinished session.                                                                                                                     |
| Landscape                | Forced Android window-manager rotation produced a 944 × 372 viewport. Library, 学 details, and reading pages had `scrollWidth === innerWidth`, with no horizontal overflow. Portrait and automatic rotation settings were restored afterward.                                                                                                                                     |

The test used remote DevTools only to drive and observe the real Android Chrome renderer. It did not use desktop mobile emulation, mocked catalog responses, browser offline emulation, or copied test fixtures in place of the shipped data.

## Memory observation

An Android `dumpsys meminfo` snapshot after offline cold start reported approximately 237 MiB PSS for the main content renderer and 153 MiB PSS for the Chrome browser process. Chrome's additional privileged, spare-renderer, and zygote processes brought their combined reported PSS to approximately 509 MiB. Android reported normal memory status on this approximately 4 GB emulator.

This is a representative snapshot, not a measured peak or an isolated application allocation. Browser infrastructure and the restored ordinary Chrome tab contribute to the process totals. It does not establish memory safety on all phones, prove behavior under sustained memory pressure, or measure battery consumption.

## Visual evidence and retained state

The committed [installed Android screenshot](screenshots/android-standalone.png) was captured from the native Android screen after the second offline restart and portrait restoration, before reconnecting the origin. It shows the actual installed app with the saved study results.

Local diagnostic evidence is intentionally ignored by Git under `docs/research/captures/`:

- `android-home-screen.png`, `android-standalone-home.png`, `android-offline-cold-native.png`.
- `android-offline-touch-writing.png`, `android-offline-landscape.png`.
- `android-initialization.json`, `android-offline-cold.json`, `android-offline-core.json`, `android-restarted-profile.json`, `android-orientation.json`.
- `android-cold-process-meminfo.txt`, `android-cold-chrome-meminfo.txt`, and initialization memory samples.

The ADB reverse mapping for port 8080 was restored for convenient continued use. The temporary local DevTools forward on port 9223 was removed. The PWA remains installed with its four verification reviews; the original Android application was not reset or cleared.

## Precise limits

- Physical Android hardware, physical iOS/Safari home-screen installation, OS storage eviction, prolonged suspension, physical sensor-driven rotation, and device-local speech voice availability were not tested here.
- Network denial targeted the app origin by removing ADB forwarding; the emulator's global Wi-Fi/data state was not changed.
- Touch traces were sent through Android Chrome's input protocol, not a physical finger or stylus. Mouse geometry and direction rejection are additionally covered in the Chromium/WebKit production suites and unit tests.
- Browser backup/import, extension import, custom collections, corrupted downloads, and cancellation are covered separately by production Chromium/WebKit tests. This Android pass did not repeat native Android file-picker/export interaction.
- The accepted functional scope and native-specific adaptations are listed in [requirements](requirements.md#native-parity-boundaries-at-delivery). This report does not claim equivalence to unavailable paid texts, proprietary Android algorithms, or unprovided dictionary snapshots.

## Version 0.1.1 update follow-up — 2026-10-07

The same installed Android WebAPK was checked at approximately 11:59–12:03 CST, without reinstalling it, clearing its profile, or clearing its reference-content cache. The final Docker image was `d8e2a1100e48`, loading `assets/index-CrnU4lj0.js` and shell cache `kanji-shell-b7053e7d06908f10`.

- **Update flow:** the existing app initially retained its previous shell. An explicit `ServiceWorkerRegistration.update()` check through remote DevTools discovered the waiting worker and displayed the application's real **A new version is ready / Update app** banner. Native Android touch on **Update app** activated the worker and reloaded the installed app. The same flow was repeated when the corrected final build replaced the intermediate candidate. Immediate automatic notification after a reload was not established by this check.
- **Data preservation:** the complete IndexedDB profile, serialized before either update and after final dictionary navigation, was exactly equal. All four existing study events, the existing read-sentence entry, settings, notes, favorites, sets, and other profile fields remained unchanged. The `kanji-reference-assets-v1` cache remained present throughout; only obsolete shell caches were replaced.
- **Pitch display:** 漢字 (`#word/1213170`) showed the か・ん・じ mora graph with low/high/high pitch and an additional hollow high particle dot for accent 0. The separate muted **Noun** line and its definition were visible. See the [final Android dictionary screenshot](screenshots/android-dictionary-pitch.png).
- **Sentence navigation:** native touch on the first 漢字 example opened `#sentence/2381`, showing ruby, the English translation, linked words 今日 → 漢字 → 書き取る in sentence order, and six constituent kanji. Tapping the linked 漢字 span returned to its word page. The final build also preserved the inline qualifier order in 書き取る's two senses. See the [final Android sentence screenshot](screenshots/android-sentence-detail.png).
- **Presentation:** the app remained in standalone display mode, and the sentence page had no horizontal overflow at the same 448-pixel portrait viewport. No study answer, read marker, favorite, or note was changed during this follow-up.

This follow-up verifies the installed-app upgrade and new dictionary UI. It does not repeat the earlier process-cold offline acceptance or physical-device limitations above. Removing an ADB reverse mapping while Chrome is running is not sufficient independent network-denial evidence because existing connections may remain usable. Port 8080 forwarding was restored, the temporary DevTools forwarding was removed, and the original Android reference app's data was untouched. Detailed before/after snapshots remain ignored under `docs/research/captures/android-011-*`.
