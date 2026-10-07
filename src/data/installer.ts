import { openDB } from "idb";
import { appUrl } from "../lib/urls";
import type { InstallProgress } from "../domain/types";
import {
  parseManifest,
  sha256,
  type CatalogManifest,
  type CatalogAsset,
} from "./manifest";

export const CATALOG_CACHE = "kanji-reference-assets-v1";
const metadata = () =>
  openDB("kanji-reference-metadata", 1, {
    upgrade(db) {
      db.createObjectStore("state");
    },
  });

export async function installedManifest(): Promise<CatalogManifest | null> {
  const db = await metadata();
  const value: unknown = await db.get("state", "active");
  db.close();
  return value ? parseManifest(value) : null;
}

async function hasAsset(cache: Cache, asset: CatalogAsset): Promise<boolean> {
  const response = await cache.match(asset.path);
  return (
    response?.headers.get("x-kanji-sha256") === asset.sha256 &&
    response.headers.get("content-length") === String(asset.bytes)
  );
}

export async function isCatalogInstalled(): Promise<boolean> {
  const manifest = await installedManifest();
  if (!manifest) return false;
  const cache = await caches.open(CATALOG_CACHE);
  for (const asset of manifest.assets)
    if (!(await hasAsset(cache, asset))) return false;
  return true;
}

export async function readInstalledAsset(assetPath: string): Promise<Response> {
  const response = await (await caches.open(CATALOG_CACHE)).match(assetPath);
  if (!response)
    throw new Error(
      "An offline resource is missing. Reconnect and initialize the library again.",
    );
  return response;
}

export async function installCatalog(
  onProgress?: (progress: InstallProgress) => void,
  update = false,
  signal?: AbortSignal,
): Promise<CatalogManifest> {
  const active = await installedManifest();
  if (!update && active && (await isCatalogInstalled())) return active;
  let manifest: CatalogManifest;
  try {
    const response = await fetch(appUrl("data/manifest.json"), {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = parseManifest(await response.json());
  } catch (error) {
    if (signal?.aborted) throw error;
    if (update)
      throw new Error("Connect to the internet to check for library updates.");
    if (!active)
      throw new Error(
        "Connect to the internet to download the offline library.",
      );
    manifest = active;
  }
  const cache = await caches.open(CATALOG_CACHE);
  const totalBytes = manifest.assets.reduce(
    (total, asset) => total + asset.bytes,
    0,
  );
  let bytes = 0,
    completed = 0;
  const report = (phase: string, downloading = 0) =>
    onProgress?.({
      phase,
      completed,
      total: manifest.assets.length,
      bytes: bytes + downloading,
      totalBytes,
    });
  // Persistence is best-effort. Quota failures remain actionable and do not replace the active catalog.
  if (navigator.storage?.persist)
    await navigator.storage.persist().catch(() => false);
  for (const asset of manifest.assets) {
    signal?.throwIfAborted();
    if (!(await hasAsset(cache, asset))) {
      report(
        asset.kind === "audio"
          ? "Downloading pronunciation audio"
          : "Downloading dictionary",
      );
      const response = await fetch(appUrl(asset.path), { signal });
      if (!response.ok)
        throw new Error(
          `A library download failed (HTTP ${response.status}). Reconnect and retry; completed files are preserved.`,
        );
      // Preallocate once from verified manifest metadata to avoid retaining a second full copy.
      const data = new Uint8Array(asset.bytes);
      let received = 0;
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const result = await reader.read();
          if (result.done) break;
          if (received + result.value.byteLength > asset.bytes) {
            await reader.cancel();
            throw new Error(
              "A library download exceeded its expected size. Retry to download a clean copy.",
            );
          }
          data.set(result.value, received);
          received += result.value.byteLength;
          report(
            asset.kind === "audio"
              ? "Downloading pronunciation audio"
              : "Downloading dictionary",
            received,
          );
        }
      } else {
        const chunk = new Uint8Array(await response.arrayBuffer());
        if (chunk.byteLength !== asset.bytes)
          throw new Error(
            "A library file has an unexpected size. Retry to download a clean copy.",
          );
        data.set(chunk);
        received = chunk.byteLength;
      }
      if (
        received !== asset.bytes ||
        (await sha256(data.buffer)) !== asset.sha256
      )
        throw new Error(
          "A downloaded library file failed its integrity check. Retry to download a clean copy.",
        );
      signal?.throwIfAborted();
      try {
        await cache.put(
          asset.path,
          new Response(data, {
            headers: {
              "content-type": "application/octet-stream",
              "content-length": String(asset.bytes),
              "x-kanji-sha256": asset.sha256,
            },
          }),
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "QuotaExceededError"
        )
          throw new Error(
            "There is not enough device storage for the offline library. Free some space and retry; your study progress is preserved.",
          );
        throw error;
      }
    }
    bytes += asset.bytes;
    completed += 1;
    report("Verifying offline library");
  }
  signal?.throwIfAborted();
  const db = await metadata();
  await db.put("state", manifest, "active");
  db.close();
  report("Library ready");
  return manifest;
}

/** Remove only downloadable reference data. User-owned progress has a different database. */
export async function removeInstalledCatalog(): Promise<void> {
  await caches.delete(CATALOG_CACHE);
  const db = await metadata();
  await db.clear("state");
  db.close();
}
