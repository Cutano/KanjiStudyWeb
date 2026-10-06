import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Download,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  CharacterKey,
  CharacterSummary,
  CustomSet,
} from "../domain/types";
import { exportCollection, splitCollection } from "../domain/collections";
import { catalog } from "../data/catalog";
import { useProfile } from "../state/useProfile";
import { updateProfile } from "../state/profile";
import { useAsync } from "../lib/hooks";
import {
  BackButton,
  CharacterCard,
  Empty,
  ErrorNotice,
  Loading,
  Modal,
} from "../components/common";
import { downloadFile } from "../lib/files";
import { SetPicker } from "./CollectionPicker";

interface Props {
  id: string;
  onStudy: (items: CharacterSummary[], title: string) => void;
  onAddToSet: (keys: CharacterKey[]) => void;
}

export function SetDetails({ id, onStudy, onAddToSet }: Props) {
  const profile = useProfile();
  const set = profile.sets.find((item) => item.id === id);
  const result = useAsync(
    () =>
      set?.keys.length
        ? catalog.getCharacters({ keys: set.keys, limit: 8000 })
        : Promise.resolve({ items: [], total: 0 }),
    [id, set?.updatedAt],
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reorder, setReorder] = useState(false);
  const [selected, setSelected] = useState<CharacterKey[]>([]);
  const [moving, setMoving] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [batchSize, setBatchSize] = useState(profile.settings.sessionSize);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSelected([]);
    setReorder(false);
    setError("");
    setNotice("");
  }, [id]);
  if (!set)
    return (
      <div className="page">
        <BackButton fallback="sets" />
        <Empty title="This set is no longer here">
          Create a new collection from your library.
        </Empty>
      </div>
    );
  const lookup = new Map(result.data?.items.map((item) => [item.key, item]));
  const items = set.keys.flatMap((key) =>
    lookup.has(key) ? [lookup.get(key)!] : [],
  );
  const selectedKeys = set.keys.filter((key) => selected.includes(key));

  async function perform(action: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      return true;
    } catch (reason) {
      setError((reason as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function mutate(change: (draft: CustomSet) => void): Promise<boolean> {
    return perform(() =>
      updateProfile((draft) => {
        const current = draft.sets.find((item) => item.id === id);
        if (!current)
          throw new Error(
            "This collection was removed. Return to your collections.",
          );
        change(current);
        current.updatedAt = Math.max(Date.now(), current.updatedAt + 1);
      }),
    );
  }
  async function addText() {
    await perform(async () => {
      const keys = [...new Set([...text])]
        .filter((glyph) =>
          /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(glyph),
        )
        .map(
          (glyph) =>
            `${/\p{Script=Hiragana}/u.test(glyph) ? "hiragana" : /\p{Script=Katakana}/u.test(glyph) ? "katakana" : "kanji"}:${glyph.codePointAt(0)}` as CharacterKey,
        );
      const found = keys.length
        ? await catalog.getCharacters({ keys, limit: 8000 })
        : { items: [] };
      if (!found.items.length)
        throw new Error(
          "No characters from the catalog were found in that text.",
        );
      const available = new Set(found.items.map((item) => item.key));
      await updateProfile((draft) => {
        const current = draft.sets.find((item) => item.id === id);
        if (!current)
          throw new Error(
            "This collection was removed. Return to your collections.",
          );
        current.keys = [
          ...new Set([
            ...current.keys,
            ...keys.filter((key) => available.has(key)),
          ]),
        ];
        current.updatedAt = Math.max(Date.now(), current.updatedAt + 1);
      });
      setText("");
    });
  }
  function exportCsv() {
    const rows = [
      ["Character", "Meaning", "On reading", "Kun reading", "Key"],
      ...items.map((item) => [
        item.glyph,
        item.meaning,
        item.onReading.replace(/[!*]/g, ""),
        item.kunReading.replace(/[!*]/g, ""),
        item.key,
      ]),
    ];
    downloadFile(
      `${set!.name}.csv`,
      "\uFEFF" +
        rows
          .map((row) =>
            row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
          )
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  async function split() {
    let count = 0;
    if (
      await perform(() =>
        updateProfile((draft) => {
          count = splitCollection(draft, id, batchSize, Date.now());
        }),
      )
    ) {
      setSplitting(false);
      setNotice(
        `${count} new batches created. Your original collection is unchanged.`,
      );
    }
  }
  async function removeCollection() {
    if (
      !confirm(`Delete “${set!.name}”? Your character progress will be kept.`)
    )
      return;
    if (
      await perform(() =>
        updateProfile((draft) => {
          draft.sets = draft.sets.filter((item) => item.id !== id);
        }),
      )
    )
      location.hash = "sets";
  }
  function reorderCharacter(key: CharacterKey, direction: number) {
    return mutate((current) => {
      const index = current.keys.indexOf(key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.keys.length) return;
      [current.keys[index], current.keys[next]] = [
        current.keys[next]!,
        current.keys[index]!,
      ];
    });
  }

  return (
    <div className="page">
      <BackButton fallback="sets" />
      <div className="page-heading spaced-top">
        <div>
          <p className="eyebrow">
            YOUR COLLECTION · {set.keys.length} CHARACTERS
          </p>
          <h1>{set.name}</h1>
          <p className="subtitle">
            {set.description || "A few characters, gathered with intention."}
          </p>
        </div>
        <div className="button-group wrap">
          <button
            className="icon-button"
            aria-label="Edit set"
            onClick={() => {
              setName(set.name);
              setDescription(set.description);
              setEditing(true);
            }}
          >
            <Pencil size={19} />
          </button>
          <button
            className="button"
            disabled={!items.length}
            onClick={() => onStudy(items, set.name)}
          >
            Study this set
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <ErrorNotice message={error || result.error} />
      {notice && (
        <p role="status" className="muted">
          {notice}
        </p>
      )}
      <section className="note-panel">
        <h3>Add from Japanese text</h3>
        <p className="muted">
          Paste a sentence or a list of characters. Duplicates are collected
          just once.
        </p>
        <div className="search-toolbar">
          <input
            aria-label="Japanese text for set"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="日本語を少しずつ学ぶ。"
          />
          <button
            className="button secondary"
            disabled={busy || !text.trim()}
            onClick={addText}
          >
            <Plus size={17} />
            Add characters
          </button>
        </div>
      </section>
      <div className="results-toolbar wrap">
        <span>{items.length} characters in your order</span>
        <div className="button-group wrap">
          <button className="text-button" onClick={() => setReorder(!reorder)}>
            {reorder ? "Finish arranging" : "Arrange & remove"}
          </button>
          <button
            className="text-button"
            disabled={!items.length}
            onClick={() => onAddToSet(set.keys)}
          >
            Copy all to a set
          </button>
          <button
            className="text-button"
            disabled={!items.length}
            onClick={() => setSplitting(true)}
          >
            Split into batches
          </button>
          <button
            className="text-button"
            onClick={exportCsv}
            disabled={!items.length}
          >
            <Download size={15} />
            Export CSV / Anki
          </button>
          <button
            className="text-button"
            onClick={() =>
              downloadFile(`${set.name}.json`, exportCollection(set))
            }
          >
            Export JSON
          </button>
        </div>
      </div>
      {reorder && (
        <section className="note-panel">
          <div className="button-group wrap">
            <span>{selectedKeys.length} selected</span>
            <button
              className="text-button"
              onClick={() => setSelected(set.keys)}
            >
              Select all
            </button>
            <button className="text-button" onClick={() => setSelected([])}>
              Clear selection
            </button>
            <button
              className="button secondary"
              disabled={!selectedKeys.length || busy}
              onClick={() => onAddToSet(selectedKeys)}
            >
              Copy selected
            </button>
            <button
              className="button secondary"
              disabled={!selectedKeys.length || busy}
              onClick={() => setMoving(true)}
            >
              Move selected
            </button>
            <button
              className="text-button danger"
              disabled={!selectedKeys.length || busy}
              onClick={async () => {
                if (
                  await mutate((current) => {
                    current.keys = current.keys.filter(
                      (key) => !selectedKeys.includes(key),
                    );
                  })
                )
                  setSelected([]);
              }}
            >
              Remove selected
            </button>
          </div>
        </section>
      )}
      {result.loading ? (
        <Loading />
      ) : items.length ? (
        <div className="character-grid">
          {items.map((item, index) => (
            <div key={item.key}>
              {reorder && (
                <label className="collection-select">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.glyph}`}
                    checked={selectedKeys.includes(item.key)}
                    onChange={(event) =>
                      setSelected((keys) =>
                        event.target.checked
                          ? [...keys, item.key]
                          : keys.filter((key) => key !== item.key),
                      )
                    }
                  />
                  Select {item.glyph}
                </label>
              )}
              <CharacterCard item={item} />
              {reorder && (
                <div className="reorder-actions">
                  <button
                    aria-label={`Move ${item.glyph} earlier`}
                    disabled={busy || !index}
                    className="icon-button"
                    onClick={() => reorderCharacter(item.key, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    aria-label={`Move ${item.glyph} later`}
                    disabled={busy || index === items.length - 1}
                    className="icon-button"
                    onClick={() => reorderCharacter(item.key, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    aria-label={`Remove ${item.glyph} from set`}
                    disabled={busy}
                    className="icon-button"
                    onClick={() =>
                      mutate((current) => {
                        current.keys = current.keys.filter(
                          (key) => key !== item.key,
                        );
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Ready for your first characters">
          Paste some Japanese text above, or add characters as you explore the
          library.
        </Empty>
      )}
      {moving && (
        <SetPicker
          keys={selectedKeys}
          sourceId={id}
          onClose={() => {
            setMoving(false);
            setSelected([]);
          }}
        />
      )}
      {splitting && (
        <Modal
          title="Split into study batches"
          onClose={() => setSplitting(false)}
        >
          <div className="form-stack">
            <p className="muted">
              Keep this collection and create smaller sets in its current order.
            </p>
            <label>
              Characters per batch
              <input
                type="number"
                min={1}
                max={Math.max(1, set.keys.length)}
                value={batchSize}
                onChange={(event) => setBatchSize(Number(event.target.value))}
              />
            </label>
            <button
              className="button"
              disabled={busy || !Number.isInteger(batchSize) || batchSize < 1}
              onClick={split}
            >
              Create batches
            </button>
            <ErrorNotice message={error} />
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title="Edit your collection" onClose={() => setEditing(false)}>
          <div className="form-stack">
            <label>
              Name
              <input
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <button
              disabled={busy || !name.trim()}
              className="button"
              onClick={async () => {
                if (
                  await mutate((current) => {
                    current.name = name.trim();
                    current.description = description;
                  })
                )
                  setEditing(false);
              }}
            >
              <Check size={16} />
              Save collection
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={removeCollection}
            >
              <Trash2 size={16} />
              Delete collection
            </button>
            <ErrorNotice message={error} />
          </div>
        </Modal>
      )}
    </div>
  );
}
