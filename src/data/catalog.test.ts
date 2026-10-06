import { afterEach, expect, it, vi } from "vitest";
import type { CatalogManifest } from "./manifest";

const installer = vi.hoisted(() => ({
  installCatalog: vi.fn(),
  isCatalogInstalled: vi.fn(),
  readInstalledAsset: vi.fn(),
  removeInstalledCatalog: vi.fn(),
}));
vi.mock("./installer", () => installer);
afterEach(() => vi.unstubAllGlobals());

it("waits for an aborted update to settle before removing reference storage", async () => {
  const manifest = {
    version: "initial",
    catalogPath: "/data/catalog.bin",
    audioIndexPath: "/data/index.json",
    assets: [],
  } as unknown as CatalogManifest;
  installer.installCatalog.mockResolvedValueOnce(manifest);
  installer.readInstalledAsset.mockImplementation(
    async () => new Response("{}"),
  );
  class TestWorker extends EventTarget {
    postMessage({ id }: { id: number }) {
      queueMicrotask(() =>
        this.dispatchEvent(
          new MessageEvent("message", { data: { id, result: undefined } }),
        ),
      );
    }
    terminate() {}
  }
  vi.stubGlobal("Worker", TestWorker);
  const { catalog } = await import("./catalog");
  await catalog.initialize();

  let finishUpdate!: () => void;
  let updateSignal: AbortSignal | undefined;
  installer.installCatalog.mockImplementationOnce(
    async (_progress, _update, signal: AbortSignal) => {
      updateSignal = signal;
      // CacheStorage/IndexedDB writes already in flight cannot be canceled by fetch's signal.
      await new Promise<void>((resolve) => {
        finishUpdate = resolve;
      });
      return { ...manifest, version: "updated" };
    },
  );
  const update = catalog.downloadUpdate();
  await vi.waitFor(() => expect(updateSignal).toBeDefined());
  expect(catalog.downloadUpdate()).toBe(update);
  const removal = catalog.removeCatalog();
  expect(updateSignal!.aborted).toBe(true);
  await Promise.resolve();
  expect(installer.removeInstalledCatalog).not.toHaveBeenCalled();
  finishUpdate();
  await update;
  await removal;
  expect(installer.removeInstalledCatalog).toHaveBeenCalledOnce();
});
