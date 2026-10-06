import { useRef, useState } from "react";
import { FolderInput } from "lucide-react";
import { catalog } from "../data/catalog";
import {
  parseCollectionImport,
  type CollectionImport as ImportedCollection,
} from "../domain/collections";
import { ErrorNotice } from "../components/common";

export function CollectionImport({
  onImport,
}: {
  onImport: (collection: ImportedCollection) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function read(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 2 * 1_024 * 1_024)
        throw new Error("Collection files must be smaller than 2 MiB.");
      const imported = parseCollectionImport(await file.text(), file.name);
      const found = imported.keys.length
        ? await catalog.getCharacters({ keys: imported.keys, limit: 8000 })
        : { items: [] };
      const resolved = new Set(found.items.map((item) => item.key));
      if (imported.keys.some((key) => !resolved.has(key)))
        throw new Error(
          "The file contains characters unavailable in this catalog. No collection was changed.",
        );
      await onImport(imported);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <FolderInput size={17} />
        {busy ? "Importing…" : "Import collection"}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept=".json,.csv,application/json,text/csv"
        aria-label="Import collection file"
        onChange={(event) => read(event.target.files?.[0])}
      />
      <ErrorNotice message={error} />
    </div>
  );
}
