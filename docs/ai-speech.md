# Optional AI Speech — 0.2.0

## Requested behavior

When a vocabulary recording is unavailable, use the AI TTS API configured by the user. When no API key is configured, use Japanese browser speech. Cache generated audio to avoid repeated requests, retaining at most ten clips and 50 MB.

## Playback and settings

- Bundled native recordings always take priority, including while offline. Missing recording files can fall through to speech generation.
- Word rows, word details, study vocabulary, reading pages, and standalone sentence details use the same playback service. Vocabulary speech uses the first supplied reading; sentences use their text without ruby markup.
- Settings → **AI speech** stores an endpoint, API key, model, and voice. Saving applies them together; merely editing the endpoint never sends the existing key to a new provider. Clearing the key disables AI speech.
- Defaults follow the requested [OpenAI text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech): `https://api.openai.com/v1/audio/speech`, `gpt-4o-mini-tts`, and `coral`. Model and voice remain editable for compatible providers.
- The API receives a direct authenticated `POST` with `model`, `voice`, `input`, and `response_format: "mp3"`. Input is limited to 4,096 characters, following the [speech API reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create).
- Generated playback displays **AI voice**. Provider/network errors remain visible; they do not cause hidden retries or silent voice changes. Another click explicitly retries a failed request.
- Browser speech prefers a locally installed Japanese voice. An online Japanese browser voice can be used when connected; an offline device without a local Japanese voice receives an explanation. It never claims uncached AI generation works offline.
- Starting another clip or leaving its view stops the previous playback and prevents a delayed response from speaking afterward. An already-started generation can finish into the cache for later reuse.

## Storage and request ownership

`kanji-study-web-tts` is a separate IndexedDB database. It stores device-only settings, disposable audio bytes with their MIME type, and cache metadata. Audio is reconstructed as a Blob only for playback; storing ArrayBuffer data avoids a WebKit Blob persistence failure reproduced during acceptance. Database version 2 replaces the initial candidate's disposable audio store while retaining settings and metadata. Study-profile imports, exports, and resets do not contain or replace the API key or generated audio. Settings exposes separate controls to clear the key and audio cache.

The cache identity contains the endpoint, model, voice, and normalized input; it never contains the key. Rotating credentials does not invalidate a matching generated clip. Changing provider, model, voice, or text creates a distinct identity.

Reads advance a monotonic access counter. Insertion and least-recently-used eviction commit in one transaction, maintaining **both** limits:

- At most **10 clips**.
- At most **50,000,000 audio bytes** (decimal 50 MB).

In-flight promises merge identical requests within a page. Web Locks merge them across pages by rechecking the persistent cache after acquiring the request lock. On browsers without Web Locks, repeated clicks in one page are still merged, and cache-size transactions remain safe across pages. Clearing the cache waits for active requests where Web Locks exist; a persisted generation counter also prevents earlier requests from refilling a cleared cache without Web Locks.

Responses have a 30-second deadline and are read with a 50 MB streaming bound. Empty, oversized, non-audio, and unsuccessful HTTP responses are not cached. There is no automatic billing retry. Cache eviction, explicit clearing, or browser storage removal means a later playback can require generation again.

## Deployment and privacy

There is no application backend or shared server API key. The user supplies their own key on each browser/device. The chosen provider must allow browser requests from the deployment origin through CORS. HTTPS endpoints are accepted; HTTP is accepted only for `localhost` and `127.0.0.1` development providers. URLs with embedded credentials, query strings, or fragments are rejected.

The Docker CSP permits HTTPS API connections and those two HTTP loopback hosts; script, worker, and media policies remain locally scoped. Credentials are sent only in the Authorization header, without cookies or redirects. Error messages do not echo provider response bodies or secrets. A browser-stored key remains accessible to code running on that origin; this is a personal-key feature, not secure distribution of a publisher-owned secret.

Unconfigured installations continue to make no AI provider calls. Initial library installation does not require this optional service, and generated audio already in the cache remains playable offline while AI speech is configured.

## Verification

- TypeScript, formatting, and production build passed.
- 108 unit/integration tests passed. New checks cover source priority, canceled/stale playback, settings validation and backup exclusion, cache identity, both LRU bounds, concurrent requests/writers, cache clearing, error recovery, bounded response reads, byte/MIME round trips, and candidate database migration.
- All 28 existing production browser cases passed. The four new TTS cases passed on Chromium desktop and mobile WebKit after correcting the Blob persistence issue, for 32 covered acceptance cases overall. The final TTS run used `index-D9x8B4QF.js`; the earlier candidate's two WebKit failures are retained as diagnostic evidence, not reported as passes.
- TTS acceptance uses the production CSP, real bundled catalog/native MP3, and a local CORS provider returning playable audio. It verifies request authorization/body, native/AI/browser selection, repeated-click cache reuse, settings persistence, backup exclusion, explicit HTTP errors, user-triggered retries, cache/key clearing, and cold offline media playback after both local hosts are stopped.
- Light/dark settings accessibility checks passed in both engines. Narrow layouts have no horizontal overflow. Inspected [desktop light settings](screenshots/ai-tts-settings-desktop.png) and [mobile dark settings](screenshots/ai-tts-settings-mobile.png); published captures show an empty API key.
- Docker rebuilt and started healthy at `http://localhost:8080`. Static-host checks passed for the shell, icons, Wasm, all nine content assets, caching, CSP, and missing-asset responses. The final image manifest list is `sha256:b27662beed8d22cf5617096bb31cba9798306c67892fe9c5648d7d2bd8c71032`.

Browser speech selection used a controlled Japanese voice stub, so it does not verify a particular operating system's installed voices. Mobile WebKit acceptance does not replace physical iOS Home Screen testing.

No user API key was requested, inspected, or used for paid generation during development. Transport and playback acceptance use a local CORS-compatible test provider with playable fixture audio. This verifies the request contract and browser behavior; it does not establish a particular account's credentials, credits, model access, or a third-party provider's compatibility.
