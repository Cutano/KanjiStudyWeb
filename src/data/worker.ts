/// <reference lib="webworker" />
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { gunzipSync } from 'fflate';
import { CatalogRepository } from './repository';
import type { CatalogRequest, CatalogResponse } from './worker-protocol';

let repository: CatalogRepository | undefined;
self.addEventListener('message', async (event: MessageEvent<CatalogRequest>) => {
  const { id, method, args } = event.data;
  try {
    let result: unknown;
    if (method === 'open') {
      const sqlite = await initSqlJs({ locateFile: () => wasmUrl });
      repository = new CatalogRepository(new sqlite.Database(gunzipSync(new Uint8Array(args[0] as ArrayBuffer))));
      result = undefined;
    } else {
      if (!repository) throw new Error('The catalog has not been opened.');
      result = Reflect.apply(repository[method], repository, args);
    }
    self.postMessage({ id, result } satisfies CatalogResponse);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'A catalog query failed.' } satisfies CatalogResponse);
  }
});
