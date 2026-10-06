import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { createDefaultProfile } from '../domain/study';
import type { UserProfile } from '../domain/types';
import { parseBackup, parseImport, validateExtension } from './validation';

interface ProfileDatabase extends DBSchema {
  profile: { key: string; value: UserProfile };
}

let profile = createDefaultProfile();
let database: IDBPDatabase<ProfileDatabase> | undefined;
let initialization: Promise<void> | undefined;
let pendingWrite: Promise<void> = Promise.resolve();
let channel: BroadcastChannel | undefined;
const listeners = new Set<() => void>();

function publish(next: UserProfile) {
  profile = next;
  for (const listener of listeners) listener();
}

export function getProfile(): UserProfile { return profile; }

export function subscribeProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function initializeProfile(): Promise<void> {
  initialization ??= (async () => {
    database = await openDB<ProfileDatabase>('kanji-study-web', 1, {
      upgrade(db) { db.createObjectStore('profile'); },
      blocking() { database?.close(); },
    });
    const transaction = database.transaction('profile', 'readwrite');
    const stored = await transaction.store.get('current');
    const initial = stored ?? createDefaultProfile();
    if (!stored) await transaction.store.put(initial, 'current');
    await transaction.done;
    publish(initial);
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('kanji-study-web-profile');
      channel.onmessage = () => {
        const refresh = pendingWrite.then(async () => {
          const latest = await database!.get('profile', 'current');
          if (latest) publish(latest);
        });
        pendingWrite = refresh.catch(() => undefined);
      };
    }
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

/** Serialize writes in this tab; the read/write transaction also serializes other tabs.
 * Publish only after the transaction commits, so visible progress is durable progress.
 */
export async function updateProfile(updater: (draft: UserProfile) => void): Promise<void> {
  await initializeProfile();
  const write = pendingWrite.then(async () => {
    const transaction = database!.transaction('profile', 'readwrite');
    const latest = await transaction.store.get('current');
    const draft = structuredClone(latest ?? createDefaultProfile());
    try {
      updater(draft);
      await transaction.store.put(draft, 'current');
      await transaction.done;
    } catch (error) {
      try { transaction.abort(); } catch { /* A failed write may already have aborted. */ }
      await transaction.done.catch(() => undefined);
      throw error;
    }
    publish(draft);
    channel?.postMessage('changed');
  });
  pendingWrite = write.catch(() => undefined);
  return write;
}

export function exportBackup(): string {
  return JSON.stringify({
    app: 'kanji-study-web', schemaVersion: 1,
    exportedAt: new Date().toISOString(), profile,
  }, null, 2);
}

export async function importBackup(json: string): Promise<void> {
  const imported = parseBackup(json);
  await updateProfile((draft) => { Object.assign(draft, imported); });
}

export async function importExtension(json: string): Promise<void> {
  const extension = validateExtension(parseImport(json));
  await updateProfile((draft) => {
    const index = draft.extensions.findIndex((previous) => previous.id === extension.id);
    if (index < 0) draft.extensions.push(extension);
    else draft.extensions[index] = extension;
  });
}
