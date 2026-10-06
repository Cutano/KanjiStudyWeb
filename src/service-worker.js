/* Built with a content-derived shell version. Catalog storage is managed separately. */
const SHELL_CACHE = "kanji-shell-__SHELL_VERSION__";
const SHELL_ASSETS = __SHELL_ASSETS__;
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/", ...SHELL_ASSETS])),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("kanji-shell-") && key !== SHELL_CACHE)
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
    url.pathname.startsWith("/data/")
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      if (event.request.mode === "navigate") {
        const exact = await cache.match(url.pathname, { ignoreVary: true });
        return (
          exact ||
          (await cache.match("/index.html", { ignoreVary: true })) ||
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
