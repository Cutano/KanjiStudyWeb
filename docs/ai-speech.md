# Optional AI Speech

## Requested behavior

When a vocabulary recording is unavailable, use the AI TTS API configured and enabled by the user. When AI speech is disabled or no API key is configured, use Japanese browser speech. Cache generated audio to avoid repeated requests, retaining at most ten clips and 50 MB.

## Playback and settings

- Bundled native recordings always take priority, including while offline. Missing recording files can fall through to speech generation.
- Word rows, word details, study vocabulary, reading pages, and standalone sentence details use the same playback service. Vocabulary speech uses the first supplied reading; sentences use their text without ruby markup.
- Settings → **AI speech** stores an endpoint, API key, model, voice, and output format. Saving applies them together; merely editing the endpoint never sends the existing key to a new provider. Clearing the key disables AI speech.
- **Enable AI speech** is an independent switch that saves immediately. Turning it off preserves credentials and cached clips but bypasses both API generation and cached AI playback. Turning it on allows matching clips to be reused. Toggling never applies unsaved edits to the endpoint, key, model, voice, or output format. Existing records without the switch field default to enabled, preserving their previous behavior without a database upgrade or cache reset.
- Defaults follow the requested [OpenAI text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech): `https://api.openai.com/v1/audio/speech`, `gpt-4o-mini-tts`, and `coral`. Model and voice remain editable for compatible providers.
- The API receives a direct authenticated `POST` with `model`, `voice`, `input`, and the selected `response_format` (`mp3` or `pcm`). New and legacy configurations default to MP3. Input is limited to 4,096 characters, following the [speech API reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create).
- Select **PCM · Gemini TTS** for Gemini TTS on OpenRouter, then save. Raw signed 16-bit little-endian PCM is wrapped in a WAV container locally, without changing the samples. Missing metadata defaults to 24 kHz mono; `rate` and `channels` parameters in the response Content-Type override those defaults. Supported metadata is 8–192 kHz with one or two channels. Invalid metadata and incomplete sample frames are rejected. Existing playable audio containers are retained.
- Generated playback displays **AI voice**. Provider/network errors remain visible; they do not cause hidden retries or silent voice changes. Another click explicitly retries a failed request.
- Browser speech prefers a locally installed Japanese voice. An online Japanese browser voice can be used when connected; an offline device without a local Japanese voice receives an explanation. It never claims uncached AI generation works offline.
- Starting another clip or leaving its view stops the previous playback and prevents a delayed response from speaking afterward. An already-started generation can finish into the cache for later reuse.

## Storage and request ownership

`kanji-study-web-tts` is a separate IndexedDB database. It stores device-only settings, disposable audio bytes with their MIME type, and cache metadata. Audio is reconstructed as a Blob only for playback; storing ArrayBuffer data avoids a WebKit Blob persistence failure reproduced during acceptance. Database version 2 replaces the initial candidate's disposable audio store while retaining settings and metadata. Study-profile imports, exports, and resets do not contain or replace the API key or generated audio. Settings exposes separate controls to clear the key and audio cache.

The cache identity contains the endpoint, model, voice, normalized input, and output format; it never contains the key. MP3 retains the original four-field identity so updates do not regenerate existing paid clips; PCM adds a format field. Rotating credentials does not invalidate a matching generated clip. Changing provider, model, voice, text, or format creates a distinct identity. PCM is stored as playable WAV bytes and its 44-byte header counts toward the cache budget.

Reads advance a monotonic access counter. Insertion and least-recently-used eviction commit in one transaction, maintaining **both** limits:

- At most **10 clips**.
- At most **50,000,000 audio bytes** (decimal 50 MB).

In-flight promises merge identical requests within a page. Web Locks merge them across pages by rechecking the persistent cache after acquiring the request lock. On browsers without Web Locks, repeated clicks in one page are still merged, and cache-size transactions remain safe across pages. Clearing the cache waits for active requests where Web Locks exist; a persisted generation counter also prevents earlier requests from refilling a cleared cache without Web Locks.

Responses have a 30-second deadline and are read with a 50 MB streaming bound. Empty, oversized, non-audio, and unsuccessful HTTP responses are not cached. There is no automatic billing retry. Cache eviction, explicit clearing, or browser storage removal means a later playback can require generation again.

## Deployment and privacy

There is no application backend or shared server API key. The user supplies their own key on each browser/device. The chosen provider must allow browser requests from the deployment origin through CORS. HTTPS endpoints are accepted; HTTP is accepted only for `localhost` and `127.0.0.1` development providers. URLs with embedded credentials, query strings, or fragments are rejected.

The Docker CSP permits HTTPS API connections and those two HTTP loopback hosts; script, worker, and media policies remain locally scoped. Credentials are sent only in the Authorization header, without cookies or redirects. HTTP failures show the status and a provider JSON error message when available. Error bodies are limited to 16 KiB, displayed messages to 512 characters, and the configured key (including its URL-encoded form), Bearer tokens, and `sk-` tokens are redacted. Control characters are removed; React renders the result as text. HTML, malformed, oversized, and missing error messages fall back to the status. A browser-stored key remains accessible to code running on that origin; this is a personal-key feature, not secure distribution of a publisher-owned secret.

Unconfigured installations and installations with AI speech disabled make no AI provider calls. Initial library installation does not require this optional service, and generated audio already in the cache remains playable offline while AI speech is configured and enabled.

## 0.2.0 verification

- TypeScript, formatting, and production build passed.
- 108 unit/integration tests passed. New checks cover source priority, canceled/stale playback, settings validation and backup exclusion, cache identity, both LRU bounds, concurrent requests/writers, cache clearing, error recovery, bounded response reads, byte/MIME round trips, and candidate database migration.
- All 28 existing production browser cases passed. The four new TTS cases passed on Chromium desktop and mobile WebKit after correcting the Blob persistence issue, for 32 covered acceptance cases overall. The final TTS run used `index-D9x8B4QF.js`; the earlier candidate's two WebKit failures are retained as diagnostic evidence, not reported as passes.
- TTS acceptance uses the production CSP, real bundled catalog/native MP3, and a local CORS provider returning playable audio. It verifies request authorization/body, native/AI/browser selection, repeated-click cache reuse, settings persistence, backup exclusion, explicit HTTP errors, user-triggered retries, cache/key clearing, and cold offline media playback after both local hosts are stopped.
- Light/dark settings accessibility checks passed in both engines. Narrow layouts have no horizontal overflow. Inspected [desktop light settings](screenshots/ai-tts-settings-desktop.png) and [mobile dark settings](screenshots/ai-tts-settings-mobile.png); published captures show an empty API key.
- Docker rebuilt and started healthy at `http://localhost:8080`. Static-host checks passed for the shell, icons, Wasm, all nine content assets, caching, CSP, and missing-asset responses. The final image manifest list is `sha256:b27662beed8d22cf5617096bb31cba9798306c67892fe9c5648d7d2bd8c71032`.

Browser speech selection used a controlled Japanese voice stub, so it does not verify a particular operating system's installed voices. Mobile WebKit acceptance does not replace physical iOS Home Screen testing.

No user API key was requested, inspected, or used for paid generation during development. Transport and playback acceptance use a local CORS-compatible test provider with playable fixture audio. This verifies the request contract and browser behavior; it does not establish a particular account's credentials, credits, model access, or a third-party provider's compatibility.

## 0.2.1 enable-switch follow-up

The user requested a way to retain valid API configuration while choosing browser speech. The new immediately saved switch controls AI source selection independently from the configuration form; native recordings remain first priority.

- TypeScript, formatting, and production build passed; all 111 unit/integration tests passed. Added checks cover legacy settings without the field, explicit disabled-state persistence, retained credentials/cache, and AI bypass when disabled.
- All four affected production TTS cases passed on Chromium desktop and mobile WebKit with `index-B2nRKnJO.js`. Tests verify the switch survives reload, unsaved configuration edits are not committed by toggling, bundled recordings play when disabled, cached AI is bypassed for browser speech when disabled, and re-enabling reuses the cache without another provider request. Keyboard Space toggles preserve focus through asynchronous saves in both engines; a focus-loss issue found in the first candidate was corrected before release.
- Existing TTS error handling, cold offline cache playback, backup exclusion, light/dark accessibility, and narrow-layout checks passed in the same run. Unrelated browser cases were not rerun for this focused change.
- Inspected the switch in [desktop light settings](screenshots/ai-tts-toggle-desktop.png) and [mobile dark settings](screenshots/ai-tts-toggle-mobile.png), with no clipping and clear on/off states. Captures use empty keys in isolated test contexts.
- Docker rebuilt and started healthy at `http://localhost:8080`; static-host checks passed for the shell, icons, Wasm, nine content assets, caching, CSP, and missing-asset responses. The 0.2.1 image manifest list is `sha256:774994e9668ee043bd579be5e8176dd9828184f67b3bf4ea33f090bb9c5a6087`.

## 0.2.3 PCM compatibility fix — 2026-10-07

### Reported failure

The user's OpenRouter configuration used `https://openrouter.ai/api/v1/audio/speech`, `google/gemini-3.8-flash-tts`, and `Leda`. Safari playback on the deployed 0.2.2 application returned HTTP 400 with `Gemini TTS only supports response_format="pcm". Got "mp3".` The application always requested MP3 and hid the response message. The key was not extracted or changed during diagnosis.

The [OpenRouter TTS guide](https://openrouter.ai/docs/guides/overview/multimodal/tts) documents the speech endpoint, binary PCM responses, and optional rate/channel MIME parameters. Its [TTS tutorial](https://openrouter.ai/blog/tutorials/text-to-speech/) explains that model format support varies and raw PCM requires playback format information.

### Resolution and upgrade

- Added an explicitly saved MP3/PCM selector. For the reported configuration, keep the endpoint, model, voice, and key, choose **PCM · Gemini TTS**, and save.
- Added local PCM-to-WAV encapsulation for browser decoding and persistent offline playback. The 10-clip/50 MB limits include the WAV container bytes. PCM and MP3 cache entries remain separate; all existing MP3 settings and cache keys remain usable without a database upgrade.
- Added bounded, redacted provider JSON messages to HTTP errors. A failed request is never cached or retried automatically. Long notices are positioned inside the viewport, including sentence actions near the left edge on mobile.
- Package version is 0.2.3. This follow-up describes a local source/container repair; public Docker Hub tags and the user's HTTPS deployment are not updated by this change. The deployed app must receive the rebuilt image before the new format control is available. Study progress, the installed catalog, and existing TTS credentials remain in their existing stores.

### Verification

- All 132 unit/integration tests passed, including PCM headers and sample preservation, rate/channel metadata, incomplete samples, separate format identities, preexisting MP3 cache reuse, PCM persistence, WAV-inclusive size accounting, and provider-message redaction/bounds.
- TypeScript, formatting, and production build passed. The final production shell uses `index--NEsYawA.js`.
- The six affected production TTS browser cases passed on Chromium desktop and mobile WebKit. They use the real catalog, bundled native MP3, production CSP/service worker, and a local CORS provider. A PCM-only fixture reproduces the observed 400, then supplies one second of raw 24 kHz PCM; both engines decode the WAV at the correct duration and play it again after both servers are stopped and a new page opens. Existing source priority, enable-switch independence, backup exclusion, and cache/key controls also pass.
- Light/dark settings accessibility and narrow-layout checks passed. The format control has a verified minimum 44 CSS-pixel height. The complete provider error stays within the mobile viewport. Inspected [desktop settings](screenshots/ai-tts-pcm-desktop.png) and [mobile settings](screenshots/ai-tts-pcm-mobile.png); these captures have empty keys in isolated test profiles.
- Rebuilt the local Docker image and verified the shell, icons, Wasm, nine content assets, caching, CSP, and missing-asset responses at `http://localhost:8080`. Its local image manifest list is `sha256:d0ffea3efff7833127b3c90ef62216c2dc712c5bc150ed58c00ce4b38e368f88`; the container serves the same final shell hash as the browser acceptance build. Catalog version remains `18993e9136e118e785b8`.
- No paid provider request was used for repair acceptance. This verifies request/decoding/cache behavior, not live successful generation on the user's OpenRouter account. Automated mobile WebKit does not constitute physical iOS Home Screen acceptance.
