import type {
  CatalogStats,
  CharacterKey,
  CharacterQuery,
  InstallProgress,
} from "../domain/types";
import {
  installCatalog,
  isCatalogInstalled,
  readInstalledAsset,
  removeInstalledCatalog,
} from "./installer";
import type { AudioIndex, CatalogManifest } from "./manifest";
import type { CatalogRepository, PageOptions } from "./repository";
import type {
  CatalogMethod,
  CatalogRequest,
  CatalogResponse,
} from "./worker-protocol";

class Catalog {
  private worker?: Worker;
  private ready?: Promise<void>;
  private update?: Promise<boolean>;
  private installation?: AbortController;
  private manifest?: CatalogManifest;
  private audioIndex?: AudioIndex;
  private requestId = 0;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  isInstalled(): Promise<boolean> {
    return isCatalogInstalled();
  }

  /** Activate downloaded metadata only when every asset verifies. Reload opens the new version. */
  downloadUpdate(
    onProgress?: (progress: InstallProgress) => void,
  ): Promise<boolean> {
    if (!this.update) {
      this.update = this.applyUpdate(onProgress).finally(() => {
        this.update = undefined;
      });
    }
    return this.update;
  }

  private async applyUpdate(
    onProgress?: (progress: InstallProgress) => void,
  ): Promise<boolean> {
    await this.initialize();
    const controller = new AbortController();
    this.installation = controller;
    try {
      const next = await installCatalog(onProgress, true, controller.signal);
      return next.version !== this.manifest!.version;
    } finally {
      if (this.installation === controller) this.installation = undefined;
    }
  }

  cancelInstall(): void {
    this.installation?.abort(
      new DOMException(
        "Library download canceled. Downloaded files are saved for your next attempt.",
        "AbortError",
      ),
    );
  }

  async removeCatalog(): Promise<void> {
    this.cancelInstall();
    await this.ready?.catch(() => undefined);
    await this.update?.catch(() => undefined);
    this.worker?.terminate();
    for (const pending of this.pending.values())
      pending.reject(new Error("The offline library was removed."));
    this.pending.clear();
    this.worker = undefined;
    this.ready = undefined;
    this.manifest = undefined;
    this.audioIndex = undefined;
    await removeInstalledCatalog();
  }

  initialize(onProgress?: (progress: InstallProgress) => void): Promise<void> {
    if (!this.ready) {
      this.ready = this.open(onProgress).catch((error: unknown) => {
        this.worker?.terminate();
        this.worker = undefined;
        this.ready = undefined;
        throw error;
      });
    }
    return this.ready;
  }

  private async open(
    onProgress?: (progress: InstallProgress) => void,
  ): Promise<void> {
    const controller = new AbortController();
    this.installation = controller;
    try {
      this.manifest = await installCatalog(
        onProgress,
        false,
        controller.signal,
      );
    } finally {
      if (this.installation === controller) this.installation = undefined;
    }
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener(
      "message",
      (event: MessageEvent<CatalogResponse>) => {
        const response = event.data;
        const request = this.pending.get(response.id);
        if (!request) return;
        this.pending.delete(response.id);
        if (response.error) request.reject(new Error(response.error));
        else request.resolve(response.result);
      },
    );
    this.worker.addEventListener("error", () => {
      for (const request of this.pending.values())
        request.reject(
          new Error(
            "The dictionary worker could not start. Reload the app and try again.",
          ),
        );
      this.pending.clear();
      this.worker?.terminate();
      this.worker = undefined;
      this.ready = undefined;
    });
    const bytes = await (
      await readInstalledAsset(this.manifest.catalogPath)
    ).arrayBuffer();
    const totalBytes = this.manifest.assets.reduce(
      (total, asset) => total + asset.bytes,
      0,
    );
    onProgress?.({
      phase: "Opening dictionary",
      completed: this.manifest.assets.length,
      total: this.manifest.assets.length,
      bytes: totalBytes,
      totalBytes,
    });
    await this.request("open", [bytes], [bytes]);
    this.audioIndex = (await (
      await readInstalledAsset(this.manifest.audioIndexPath)
    ).json()) as AudioIndex;
  }

  private request(
    method: CatalogMethod | "open",
    args: unknown[],
    transfer: Transferable[] = [],
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage(
        { id, method, args } satisfies CatalogRequest,
        transfer,
      );
    });
  }
  private async query<Method extends CatalogMethod>(
    method: Method,
    args: Parameters<CatalogRepository[Method]>,
  ): Promise<ReturnType<CatalogRepository[Method]>> {
    await this.initialize();
    return (await this.request(method, args)) as ReturnType<
      CatalogRepository[Method]
    >;
  }

  getCharacters(query: CharacterQuery = {}) {
    return this.query("getCharacters", [query]);
  }
  getCharacter(key: CharacterKey) {
    return this.query("getCharacter", [key]);
  }
  searchVocabulary(query: string, options?: PageOptions) {
    return this.query("searchVocabulary", [query, options]);
  }
  getVocabulary(id: number) {
    return this.query("getVocabulary", [id]);
  }
  getSentence(id: number) {
    return this.query("getSentence", [id]);
  }
  getCharacterVocabulary(key: CharacterKey, options?: PageOptions) {
    return this.query("getCharacterVocabulary", [key, options]);
  }
  getCharacterSentences(key: CharacterKey, options?: PageOptions) {
    return this.query("getCharacterSentences", [key, options]);
  }
  getCharacterNames(key: CharacterKey, options?: PageOptions) {
    return this.query("getCharacterNames", [key, options]);
  }
  searchSentences(query: string, options?: PageOptions) {
    return this.query("searchSentences", [query, options]);
  }

  async getCatalogStats(): Promise<CatalogStats> {
    await this.initialize();
    return this.manifest!.stats;
  }
  async getAudioBlob(resourceId: string): Promise<Blob> {
    await this.initialize();
    const location = this.audioIndex![resourceId];
    if (!location)
      throw new Error("No recorded pronunciation is available for this entry.");
    const blob = await (await readInstalledAsset(location.path)).blob();
    return blob.slice(
      location.offset,
      location.offset + location.length,
      "audio/mpeg",
    );
  }
}

export const catalog = new Catalog();
