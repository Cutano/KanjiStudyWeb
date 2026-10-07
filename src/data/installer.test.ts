import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { openDB } from "idb";
import {
  installCatalog,
  installedManifest,
  isCatalogInstalled,
  removeInstalledCatalog,
  readInstalledAsset,
} from "./installer";
import type { CatalogAsset, CatalogManifest } from "./manifest";

const cached = new Map<string, Response>();
let files: Map<string, Uint8Array>;
let manifest: CatalogManifest;
const stats = {
  kanji: 7045,
  kana: 148,
  radicals: 265,
  vocabulary: 214894,
  names: 87950,
  sentences: 16277,
  audio: 8132,
};
function asset(
  path: string,
  kind: CatalogAsset["kind"],
  value: string,
): CatalogAsset {
  const bytes = new TextEncoder().encode(value);
  files.set(path, bytes);
  return {
    path,
    kind,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
function network() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/data/manifest.json") return Response.json(manifest);
    const bytes = files.get(path);
    return bytes
      ? new Response(new Uint8Array(bytes))
      : new Response(null, { status: 404 });
  });
}
beforeEach(async () => {
  vi.stubEnv("BASE_URL", "/");
  cached.clear();
  files = new Map();
  vi.stubGlobal("navigator", { storage: { persist: async () => true } });
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async (path: string) => cached.get(path)?.clone(),
      put: async (path: string, response: Response) => {
        cached.set(path, response.clone());
      },
    }),
    delete: async () => {
      cached.clear();
      return true;
    },
  });
  await removeInstalledCatalog();
  manifest = {
    schemaVersion: 1,
    version: "test-v1",
    catalogPath: "/data/catalog.bin",
    audioIndexPath: "/data/index.json",
    stats,
    assets: [
      asset("/data/catalog.bin", "catalog", "reference-catalog"),
      asset("/data/index.json", "index", "{}"),
      asset("/data/audio.bin", "audio", "recorded-pronunciation"),
    ],
  };
  vi.stubGlobal("fetch", network());
});
afterEach(() => vi.unstubAllEnvs());

describe("offline installation transactions", () => {
  it("downloads from the deployment base while retaining portable catalog identities and cached bytes", async () => {
    vi.stubEnv("BASE_URL", "/KanjiStudyWeb/");
    const server = network();
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requests.push(url);
        if (!url.startsWith("/KanjiStudyWeb/"))
          return new Response(null, { status: 404 });
        return server(url.slice("/KanjiStudyWeb".length));
      }),
    );
    await installCatalog();
    expect(requests).toEqual([
      "/KanjiStudyWeb/data/manifest.json",
      ...manifest.assets.map((asset) => `/KanjiStudyWeb${asset.path}`),
    ]);
    expect(await installedManifest()).toEqual(manifest);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await isCatalogInstalled()).toBe(true);
    expect(await (await readInstalledAsset(manifest.catalogPath)).text()).toBe(
      "reference-catalog",
    );
    expect(await installCatalog()).toEqual(manifest);
  });
  it("activates only verified assets and does not use network on an installed launch", async () => {
    const progress = vi.fn();
    await installCatalog(progress);
    expect(await isCatalogInstalled()).toBe(true);
    expect(progress.mock.calls.at(-1)?.[0].completed).toBe(3);
    const offline = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", offline);
    expect((await installCatalog()).version).toBe("test-v1");
    expect(offline).not.toHaveBeenCalled();
  });
  it("rejects corrupt bytes and resumes from already verified files", async () => {
    files.set(
      "/data/audio.bin",
      new TextEncoder().encode("corrupted-pronunciation"),
    );
    await expect(installCatalog()).rejects.toThrow(/integrity|expected size/);
    expect(await installedManifest()).toBeNull();
    expect(await isCatalogInstalled()).toBe(false);
    expect(cached.size).toBe(2);
    files.set(
      "/data/audio.bin",
      new TextEncoder().encode("recorded-pronunciation"),
    );
    const retry = network();
    vi.stubGlobal("fetch", retry);
    await installCatalog();
    expect(retry.mock.calls.map(([url]) => String(url))).toEqual([
      "/data/manifest.json",
      "/data/audio.bin",
    ]);
    expect(await isCatalogInstalled()).toBe(true);
  });
  it("retains a working version when an update fails integrity validation", async () => {
    await installCatalog();
    manifest = {
      ...manifest,
      version: "test-v2",
      catalogPath: "/data/catalog-v2.bin",
      assets: [
        asset("/data/catalog-v2.bin", "catalog", "new-catalog"),
        ...manifest.assets.slice(1),
      ],
    };
    files.set("/data/catalog-v2.bin", new TextEncoder().encode("bad-catalog"));
    await expect(installCatalog(undefined, true)).rejects.toThrow(/integrity/);
    expect((await installedManifest())?.version).toBe("test-v1");
    expect(await isCatalogInstalled()).toBe(true);
  });
  it("reports an offline update check as unavailable rather than current", async () => {
    await installCatalog();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(installCatalog(undefined, true)).rejects.toThrow(
      "Connect to the internet",
    );
  });
  it("cancels between assets without activating partial metadata", async () => {
    const controller = new AbortController();
    await expect(
      installCatalog(
        (progress) => {
          if (progress.completed === 1)
            controller.abort(new DOMException("Canceled", "AbortError"));
        },
        false,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cached.size).toBe(1);
    expect(await installedManifest()).toBeNull();
    await installCatalog();
    expect(await isCatalogInstalled()).toBe(true);
  });
  it("removes reference storage independently of user profile storage", async () => {
    const profile = await openDB("kanji-study-web", 1, {
      upgrade(db) {
        db.createObjectStore("profile");
      },
    });
    await profile.put("profile", { note: "Keep my mnemonic" }, "current");
    await installCatalog();
    await removeInstalledCatalog();
    expect(cached.size).toBe(0);
    expect(await installedManifest()).toBeNull();
    expect(await isCatalogInstalled()).toBe(false);
    expect(await profile.get("profile", "current")).toEqual({
      note: "Keep my mnemonic",
    });
    profile.close();
  });
});
