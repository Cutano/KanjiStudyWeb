import { useState } from "react";
import { FolderPlus, Plus } from "lucide-react";
import type { CharacterKey } from "../domain/types";
import { moveCollectionCharacters } from "../domain/collections";
import { updateProfile } from "../state/profile";
import { useProfile } from "../state/useProfile";
import { ErrorNotice, Modal } from "../components/common";

export function SetPicker({
  keys,
  onClose,
  sourceId,
}: {
  keys: CharacterKey[];
  onClose: () => void;
  sourceId?: string;
}) {
  const profile = useProfile();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(id?: string) {
    setSaving(true);
    setError("");
    try {
      await updateProfile((draft) => {
        const now = Date.now();
        const targetId = id ?? crypto.randomUUID();
        if (!id)
          draft.sets.push({
            id: targetId,
            name: name.trim(),
            description: "",
            keys: [],
            createdAt: now,
            updatedAt: now,
          });
        if (sourceId)
          moveCollectionCharacters(draft, sourceId, targetId, keys, now);
        else {
          const target = draft.sets.find((set) => set.id === targetId);
          if (!target)
            throw new Error(
              "This collection was removed. Choose another destination.",
            );
          target.keys = [...new Set([...target.keys, ...keys])];
          target.updatedAt = Math.max(now, target.updatedAt + 1);
        }
      });
      onClose();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={
        sourceId ? "Move these characters" : "A place for these characters"
      }
      onClose={onClose}
    >
      <p className="muted">
        {sourceId ? "Move" : "Add"} {keys.length} character
        {keys.length === 1 ? "" : "s"} to a collection.{" "}
        {sourceId && "Your learning progress stays with each character."}
      </p>
      <div className="set-picker">
        {profile.sets
          .filter((set) => set.id !== sourceId)
          .map((set) => (
            <button disabled={saving} key={set.id} onClick={() => save(set.id)}>
              <span>
                <strong>{set.name}</strong>
                <small>{set.keys.length} characters</small>
              </span>
              <Plus size={18} />
            </button>
          ))}
      </div>
      <div className="form-stack">
        <label>
          New set name
          <input
            autoFocus
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Everyday discoveries"
          />
        </label>
        <button
          className="button"
          disabled={saving || !name.trim()}
          onClick={() => save()}
        >
          <FolderPlus size={17} />
          {sourceId ? "Create set and move" : "Create set"}
        </button>
        <ErrorNotice message={error} />
      </div>
    </Modal>
  );
}
