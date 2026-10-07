import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

/** A real static origin that can be removed after the PWA installs.
 * WebKit's automation offline switch may fail before service-worker dispatch;
 * closing this server tests the browser's actual cache-only startup instead.
 */
export interface OfflineHostOptions {
  directory?: string;
  responseHeaders?: Record<string, string>;
  onRequest?: (pathname: string) => void;
  transformResponse?: (
    pathname: string,
    body: Buffer,
  ) => Buffer | Promise<Buffer>;
}
export async function startOfflineHost(options: OfflineHostOptions = {}) {
  const root = resolve(options.directory ?? "dist");
  const mime: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".wasm": "application/wasm",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".txt": "text/plain",
  };
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url || "/", "http://localhost").pathname,
    );
    options.onRequest?.(pathname);
    const path = resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    if (!path.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const original = await readFile(path);
      const body = options.transformResponse
        ? await options.transformResponse(pathname, original)
        : original;
      if (response.destroyed) return;
      response.writeHead(200, {
        ...options.responseHeaders,
        "Content-Type": mime[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "Content-Length": body.byteLength,
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server did not receive a port.");
  let closed = false;
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
