import type { CharacterKey, CustomSet, UserProfile } from './types';

export function splitCollection(profile: UserProfile, sourceId: string, size: number, now: number, makeId: () => string = () => crypto.randomUUID()): number {
  const source = profile.sets.find((set) => set.id === sourceId);
  if (!source) throw new Error('This collection was removed. Return to your collections and try again.');
  if (!Number.isInteger(size) || size < 1) throw new Error('Choose a batch size of at least one character.');
  const batches: CustomSet[] = [];
  for (let start = 0; start < source.keys.length; start += size) {
    batches.push({ ...source, id: makeId(), name: `${source.name} · ${batches.length + 1}`, keys: source.keys.slice(start, start + size), createdAt: now, updatedAt: now });
  }
  profile.sets.push(...batches);
  return batches.length;
}

/** Caller commits this entire draft in one transaction, including the source removal. */
export function moveCollectionCharacters(profile: UserProfile, sourceId: string, targetId: string, keys: readonly CharacterKey[], now: number): void {
  if (sourceId === targetId) throw new Error('Choose a different destination collection.');
  const source = profile.sets.find((set) => set.id === sourceId);
  const target = profile.sets.find((set) => set.id === targetId);
  if (!source || !target) throw new Error('A collection was removed. Return to your collections and try again.');
  const selected = new Set(keys);
  const moving = source.keys.filter((key) => selected.has(key));
  target.keys = [...new Set([...target.keys, ...moving])];
  source.keys = source.keys.filter((key) => !selected.has(key));
  target.updatedAt = Math.max(now, target.updatedAt + 1);
  source.updatedAt = Math.max(now, source.updatedAt + 1);
}

export interface CollectionImport { name: string; description: string; keys: CharacterKey[] }

function isCharacterKey(value: unknown): value is CharacterKey {
  if (typeof value !== 'string' || !/^(kanji|hiragana|katakana|radical):[1-9]\d*$/.test(value)) return false;
  const code = Number(value.split(':')[1]);
  return code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
}

function glyphKey(glyph: string): CharacterKey {
  if ([...glyph].length !== 1 || !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(glyph)) {
    throw new Error(`“${glyph}” is not a single Japanese character.`);
  }
  const kind = /\p{Script=Hiragana}/u.test(glyph) ? 'hiragana' : /\p{Script=Katakana}/u.test(glyph) ? 'katakana' : 'kanji';
  return `${kind}:${glyph.codePointAt(0)}`;
}

/** RFC 4180 field quoting, including embedded commas, double quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      row.push(field); field = '';
      if (char !== ',') {
        if (row.some((value) => value.length)) rows.push(row);
        row = [];
        if (char === '\r' && input[index + 1] === '\n') index += 1;
      }
    } else field += char;
  }
  if (quoted) throw new Error('The CSV file has an unfinished quoted field.');
  row.push(field);
  if (row.some((value) => value.length)) rows.push(row);
  return rows;
}

export function parseCollectionImport(text: string, filename: string): CollectionImport {
  if (new TextEncoder().encode(text).byteLength > 2 * 1_024 * 1_024) throw new Error('Collection files must be smaller than 2 MiB.');
  const fallbackName = filename.replace(/\.[^.]+$/, '').slice(0, 100) || 'Imported collection';
  if (filename.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{')) {
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new Error('This collection file is not valid JSON.'); }
    if (!value || typeof value !== 'object') throw new Error('Choose an exported Kanji Study Web collection.');
    const item = value as Record<string, unknown>;
    if (item.app !== 'kanji-study-web-set' || item.schemaVersion !== 1 || !Array.isArray(item.keys) || !item.keys.every(isCharacterKey)) {
      throw new Error('Choose a version 1 Kanji Study Web collection with valid character keys.');
    }
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100 || typeof item.description !== 'string' || item.description.length > 100_000) {
      throw new Error('The collection needs a name of 1–100 characters and a text description.');
    }
    return { name: item.name.trim(), description: item.description, keys: [...new Set(item.keys as CharacterKey[])] };
  }
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('This CSV file is empty.');
  const keyColumn = header.findIndex((value) => value.trim().toLowerCase() === 'key');
  const glyphColumn = header.findIndex((value) => value.trim().toLowerCase() === 'character');
  if (keyColumn < 0 && glyphColumn < 0) throw new Error('The CSV file needs a Character or Key header.');
  const keys = rows.map((row) => {
    if (keyColumn < 0) return glyphKey((row[glyphColumn] ?? '').trim());
    const key = row[keyColumn]?.trim();
    if (!isCharacterKey(key)) throw new Error('The CSV file contains an invalid character key.');
    return key;
  });
  return { name: fallbackName, description: '', keys: [...new Set(keys)] };
}

export function exportCollection(set: CustomSet): string {
  return JSON.stringify({ app: 'kanji-study-web-set', schemaVersion: 1, name: set.name, description: set.description, keys: set.keys }, null, 2);
}
