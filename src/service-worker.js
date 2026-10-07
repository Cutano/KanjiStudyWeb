/* Built with a content-derived shell version. Catalog storage is managed separately. */
const APP_BASE = __APP_BASE__;
const SHELL_VERSION = "__SHELL_VERSION__";
const SHELL_CACHE_PREFIX = `kanji-shell-${encodeURIComponent(APP_BASE)}-`;
const SHELL_CACHE = SHELL_CACHE_PREFIX + SHELL_VERSION;
const SHELL_ASSETS = __SHELL_ASSETS__;
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([APP_BASE, ...SHELL_ASSETS])),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        const ownShell = key.startsWith(SHELL_CACHE_PREFIX);
        // Upgrade legacy root installations without deleting another deployment's shell.
        const legacyRoot =
          APP_BASE === "/" && /^kanji-shell-[a-f0-9]{16}$/.test(key);
        if ((ownShell || legacyRoot) && key !== SHELL_CACHE)
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(APP_BASE) ||
    url.pathname.startsWith(`${APP_BASE}data/`)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      if (event.request.mode === "navigate") {
        const exact = await cache.match(url.pathname, { ignoreVary: true });
        return (
          exact ||
          (await cache.match(`${APP_BASE}index.html`, { ignoreVary: true })) ||
          fetch(event.request)
        );
      }
      return (
        (await cache.match(event.request, { ignoreVary: true })) ||
        fetch(event.request)
      );
    })(),
  );
});
