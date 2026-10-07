import assert from "node:assert/strict";

const origin = process.argv[2] ?? "http://127.0.0.1:8080";
const get = (path, options) => fetch(new URL(path, origin), options);
const headers = async (path) => {
  const response = await get(path, { method: "HEAD" });
  assert.equal(response.status, 200, `${path} must be available`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /wasm-unsafe-eval/,
  );
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /connect-src 'self' https: http:\/\/localhost:\* http:\/\/127\.0\.0\.1:\*;/,
    "Configured speech APIs must be reachable under the production CSP",
  );
  return response.headers;
};

const deadline = Date.now() + 10_000;
while (true) {
  try {
    assert.equal((await get("/healthz")).status, 200);
    break;
  } catch (error) {
    if (Date.now() >= deadline) throw error;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
for (const path of [
  "/",
  "/index.html",
  "/sw.js",
  "/manifest.webmanifest",
  "/data/manifest.json",
]) {
  assert.equal(
    (await headers(path)).get("cache-control"),
    "no-cache",
    `${path} must revalidate`,
  );
}

const manifest = await (await get("/manifest.webmanifest")).json();
for (const icon of manifest.icons) await headers(icon.src);

const html = await (await get("/")).text();
const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
assert.ok(script, "The production HTML must reference a bundled script");
assert.match((await headers(script)).get("cache-control") ?? "", /immutable/);

const workerSource = await (await get("/sw.js")).text();
const wasm = workerSource.match(/"(\/assets\/[^"]+\.wasm)"/)?.[1];
assert.ok(wasm, "The offline shell must include the Wasm asset");
assert.equal((await headers(wasm)).get("content-type"), "application/wasm");

const catalog = await (await get("/data/manifest.json")).json();
for (const asset of catalog.assets) {
  const response = await headers(asset.path);
  assert.match(response.get("cache-control") ?? "", /immutable/);
  assert.equal(
    Number(response.get("content-length")),
    asset.bytes,
    `${asset.path} byte length must match its manifest`,
  );
  assert.equal(
    response.get("content-encoding"),
    null,
    "Serve the stored bytes without automatic content decoding",
  );
}

for (const path of [
  "/missing.js",
  "/assets/missing-12345678.wasm",
  "/data/missing.sqlite.gz",
]) {
  const response = await get(path);
  assert.equal(response.status, 404, `${path} must not fall back to HTML`);
  assert.equal(response.headers.get("cache-control"), "no-cache");
}
assert.equal(
  (await get("/study/session")).status,
  200,
  "Navigation paths must receive the application shell",
);
console.log(
  `Static host verified at ${origin}: shell, icons, Wasm, ${catalog.assets.length} content assets, caching, CSP, and 404 behavior.`,
);
