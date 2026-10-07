# Deployment and Operations

## Static Application

Kanji Study Web has no application backend. The production server delivers HTML, scripts, styles, a compressed catalog, and audio packs. Study history, sets, customizations, and imported extensions are stored in the user's browser installation. A container restart or replacement does not delete that browser data.

The application is currently configured for the root of an origin, for example `https://kanji.example.com/`. Use a dedicated hostname; subdirectory hosting requires coordinated changes to asset URLs, manifest scope, service worker scope, and routing.

## Build and Run with Docker

### Published Docker Hub image

The public image is [cutano/kanji-study-web](https://hub.docker.com/r/cutano/kanji-study-web). The current release is `0.2.2`, also available as `latest`, with both `linux/amd64` and `linux/arm64` variants. Docker selects the host architecture automatically. Prefer a version tag or the recorded release digest for a fixed deployment; `latest` may move with future releases. Exact source revisions and image digests are recorded in [release verification](release-report.md).

Run the prebuilt image without a local database or build toolchain:

```sh
docker run -d --name kanji-study-web \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp:rw,size=16m,mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  cutano/kanji-study-web:0.2.2
```

Open [the local application](http://localhost:8080). Use the HTTPS reverse proxy below for remote devices. To explicitly select the x86-64 variant, add `--platform linux/amd64` to `docker run` or `docker pull`.

### Build from source

Requirements: Docker with Compose and BuildKit, and access to the source database at `Resource/kanji.db`.

```sh
docker compose up --build -d
docker compose ps
```

Open [the local application](http://localhost:8080). The default binding is loopback. To change its local port:

```sh
KANJI_PORT=8090 docker compose up --build -d
```

For access from a separate reverse-proxy host, set `KANJI_BIND_ADDRESS` to the intended interface address. Ordinary HTTP on a LAN IP address is insufficient for the installed PWA; use HTTPS for phone access.

The multi-stage Dockerfile uses Node 24 for the build and an unprivileged Nginx runtime on port 8080. Compose drops Linux capabilities, uses a read-only filesystem with a small temporary directory, and requires no persistent server volume. The Dockerfile pins the tested base images and build frontend by digest; review and update these pins as part of dependency maintenance. [Nginx unprivileged image documentation](https://github.com/nginx/docker-nginx-unprivileged)

The build runs:

```sh
npm ci
npm run data:prepare
npm run build
```

The data script verifies the audited source SQLite hash, removes historical learner statistics from its derived copy, and packages the catalog and all referenced Kanji alive recordings. The first build downloads the approximately 130 MB source audio archive, verifies its pinned SHA-256, and caches it through a BuildKit cache mount. Later UI rebuilds reuse the content build layer. A changed source archive fails verification rather than silently changing a release. [Docker cache mount documentation](https://docs.docker.com/build/cache/optimize/)

Do not copy a user's exported profile into the image. The source database, generated catalog, audio attribution, and dependency licenses have distinct provenance; consult project licensing documents before redistributing a deployment.

## HTTPS Reverse Proxy

Terminate TLS at the existing reverse proxy and forward the dedicated hostname to container port 8080. For example, an operator-managed Caddy instance on the same host can use:

```caddyfile
kanji.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Replace the hostname with the actual configured DNS name. Configure certificate issuance, firewall exposure, and proxy policy in the hosting environment. There are no application secrets or server database credentials to provision.

The included Nginx configuration sends a content security policy allowing local scripts, Wasm, local workers, and audio Blob URLs. Inline styles support the current React presentation. It also sets MIME types, prevents framing, disables content sniffing, and retains the same headers in static resource locations. If the reverse proxy adds its own policy, ensure it permits the application's local Wasm and worker execution.

Optional user-configured [AI speech](ai-speech.md) additionally uses `connect-src` access to HTTPS providers or HTTP loopback providers (`localhost` and `127.0.0.1`). A reverse proxy's policy must also permit the selected API origin. That provider must accept browser CORS requests. The deployment never receives a shared API secret: each user configures their own device-local key, and generated audio stays in a separate browser cache.

## Cache and Routing Contract

| Resource                                                                     | Server policy                                                           |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| HTML, service worker entry, web manifest, catalog manifest, fixed-name icons | `Cache-Control: no-cache`; revalidation allowed.                        |
| Fingerprinted Vite assets and content-hashed data files                      | Long-lived immutable caching.                                           |
| `.wasm`                                                                      | `application/wasm`.                                                     |
| Missing static asset or `/data/` file                                        | HTTP 404, never the HTML shell.                                         |
| Application navigation                                                       | HTML shell fallback; hash routes work without server route definitions. |
| `/healthz`                                                                   | HTTP 200 with a small text response.                                    |

Do not rewrite a missing database or Wasm request to `index.html`. The packaged `.sqlite.bin` file contains gzip-compressed data; do not add `Content-Encoding: gzip` to it, because the application verifies the stored bytes and performs decompression itself. Do not disable or transform service worker scripts at a CDN.

## Initial Installation

1. Open the HTTPS site on the intended device.
2. Install through the Android browser's install action, or use Add to Home Screen on iOS and launch from that icon.
3. Initialize inside the installed application. Keep it foregrounded until it reports the resources are verified and ready offline.
4. Enable airplane mode, close and reopen the app, and verify a new dictionary lookup and study session.

Do not assume data downloaded in Safari transfers to a newly installed Home Screen app. Each browser profile or installed context may have separate storage. A browser may decline persistent-storage requests or a user may clear site data; progress exports provide a portable recovery route.

## Updating and Recovery

Rebuild and replace the container to publish a new static release:

```sh
docker compose up --build -d
docker compose logs --tail=50
```

The application manages installed-shell and content updates. Users should finish or save active sessions before accepting a reload. A server rollback changes offered static assets; it does not roll back a user's IndexedDB schema or learning data. Test schema compatibility before rolling back across a personal-storage migration.

If initialization fails, inspect the displayed failure, available browser storage, and server asset responses. Retry repairs the catalog without resetting personal progress. A failed pinned-source verification during the build requires a provenance review; do not remove the hash check.

For a migration to a different origin, users must export and import their personal backups. Changing scheme, hostname, or port changes the browser storage origin. Server filesystem backups cannot recover browser-resident study history.

## Local Development and Static Hosting

Use Node 24 or newer:

```sh
npm ci
npm run data:prepare
npm run dev
```

The small committed PNG icons are rendered from `public/icon.svg` by `node scripts/generate-icons.mjs` after installing Playwright Chromium. The SVG uses geometry only and requires no external font. Regenerate icons when changing that artwork. `node scripts/prepare-licenses.mjs` refreshes offline project and runtime dependency license text; Docker and CI run it before bundling.

For production verification:

```sh
npm test
npm run build
npm run preview
```

The `dist/` directory can be served by another HTTPS static host if it preserves the MIME, caching, asset failure, and navigation behavior above. Vite preview is intended for local verification. [Vite static deployment documentation](https://vite.dev/guide/static-deploy.html)

GitHub Actions runs a locked dependency install, formatting checks, a verified cached content build, unit tests, the production build, Chromium and mobile WebKit browser journeys, automated accessibility checks, and static checks through the pinned production Nginx configuration. It retains the production build and browser reports, including failure screenshots and traces. The same host checks can be run against a local container with `node scripts/verify-static-host.mjs http://127.0.0.1:8080`. Actual Home Screen/device verification remains a distinct release gate; see [release checklist](release-checklist.md).
