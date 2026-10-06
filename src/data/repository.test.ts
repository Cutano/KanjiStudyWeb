import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { CatalogRepository, SEQUENCE_SYSTEMS } from './repository';
import { parseManifest } from './manifest';
import { cleanReading, parseSentence, plainSentence, vocabularyLabel, vocabularyMeaning } from './text';

let repository: CatalogRepository;
let database: Database;
const manifest = parseManifest(JSON.parse(readFileSync('public/data/manifest.json', 'utf8')));
beforeAll(async () => {
  const sqlite = await initSqlJs();
  database = new sqlite.Database(gunzipSync(readFileSync(`public${manifest.catalogPath}`)));
  repository = new CatalogRepository(database);
});

describe('audited catalog integrity', () => {
  it('leaves the supplied source unchanged and excludes source analytics', () => {
    expect(createHash('sha256').update(readFileSync('Resource/kanji.db')).digest('hex')).toBe('f0ab73a3a8d425455f93647c4305b76185d8156592df0cf534bbf4f7674ce4e6');
    expect(database.exec('PRAGMA integrity_check')[0].values[0][0]).toBe('ok');
    expect(database.exec("SELECT name FROM sqlite_master WHERE name IN ('analytics', 'quiz_mistake', 'draw_mistake')")).toEqual([]);
    expect(repository.getCharacters().total).toBe(7045);
    expect(repository.getCharacters({ kind: 'hiragana' }).total).toBe(74);
    expect(repository.getCharacters({ kind: 'katakana' }).total).toBe(74);
    expect(repository.getCharacters({ kind: 'radical' }).total).toBe(265);
  });
  it('preserves all sequence permutations and the revised grade counts', () => {
    for (const system of SEQUENCE_SYSTEMS) {
      const result = repository.getCharacters({ system, limit: 10000 });
      expect(result.items.map((character) => character.sequence)).toEqual(Array.from({ length: 7045 }, (_, index) => index + 1));
    }
    expect([1, 2, 3, 4, 5, 6].reduce((total, level) => total + repository.getCharacters({ system: 'jouyou_revised', level }).total, 0)).toBe(1026);
  });
  it('verifies every generated asset and every audio slice', () => {
    const buffers = new Map(manifest.assets.map((asset) => {
      const bytes = readFileSync(`public${asset.path}`);
      expect(bytes.length).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      return [asset.path, bytes];
    }));
    const index = JSON.parse(readFileSync(`public${manifest.audioIndexPath}`, 'utf8')) as Record<string, { path: string; offset: number; length: number }>;
    expect(Object.keys(index)).toHaveLength(8132);
    for (const location of Object.values(index)) {
      const shard = buffers.get(location.path)!;
      expect(location.offset + location.length).toBeLessThanOrEqual(shard.length);
      expect(shard.subarray(location.offset, location.offset + 3).toString()).toBe('ID3');
    }
  });
});

describe('typed repository queries', () => {
  it('resolves supplementary Unicode, missing paths, and uncataloged components', () => {
    expect(repository.getCharacter('kanji:134047').glyph).toBe('𠮟');
    const missing = Number(database.exec('SELECT code FROM kanji WHERE stroke_paths IS NULL LIMIT 1')[0].values[0][0]);
    expect(repository.getCharacter(`kanji:${missing}`).paths).toEqual([]);
    const example = Number(database.exec('SELECT kanji_code FROM kanji_radical_link WHERE radical_code NOT IN (SELECT code FROM radical) LIMIT 1')[0].values[0][0]);
    expect(repository.getCharacter(`kanji:${example}`).components.length).toBeGreaterThan(0);
    expect(repository.getCharacter('kanji:23398').paths).toHaveLength(8);
    expect(repository.getCharacter('radical:23376').key).toBe('radical:23376');
  });
  it('combines level, component, stroke, kana, and romaji filters', () => {
    expect(repository.getCharacters({ query: 'gaku' }).items.some((character) => character.glyph === '学')).toBe(true);
    expect(repository.getCharacters({ query: 'まなぶ' }).items.some((character) => character.glyph === '学')).toBe(true);
    expect(repository.getCharacters({ query: 'がく', strokeCount: 8, level: 1, components: [23376] }).items.some((character) => character.glyph === '学')).toBe(true);
    expect(repository.getCharacters({ query: '%' }).items.map((character) => character.glyph)).toEqual(['分', '率']);
    expect(repository.getCharacters({ keys: ['kanji:23398', 'hiragana:12354', 'radical:23376'] }).total).toBe(3);
    expect(repository.getCharacters({ keys: [] })).toEqual({ total: 0, items: [] });
  });
  it('evaluates intersected text, JLPT, stroke, audio, common, and POS predicates', () => {
    expect(repository.getCharacters({ query: 'n5 8 study learning' }).items.map((item) => item.glyph)).toContain('学');
    expect(repository.getCharacters({ query: 'n5 8 study -learning' }).items.map((item) => item.glyph)).not.toContain('学');
    expect(repository.getCharacters({ query: 'n?' }).total).toBe(4819);
    expect(repository.getCharacters({ query: '"gaku"' }).items.map((item) => item.glyph)).not.toContain('学');
    expect(repository.searchVocabulary('学校 common audio n5 pos:n').items.map((word) => word.id)).toContain(1206730);
    expect(repository.searchVocabulary('学校 -audio').items.map((word) => word.id)).not.toContain(1206730);
    expect(repository.searchVocabulary('school pos:verb').items.every((word) => word.tags.split(' ').some((tag) => /^v(?:[1-5]|[szkrn])/.test(tag)))).toBe(true);
  });
  it('retains vocabulary relationships without duplicate entities and pages deterministically', () => {
    const related = repository.getCharacterVocabulary('kanji:23398', { limit: 10000 });
    expect(new Set(related.items.map((word) => word.id)).size).toBe(related.total);
    const first = repository.searchVocabulary('school', { limit: 2 });
    const second = repository.searchVocabulary('school', { limit: 2, offset: 2 });
    expect(first.total).toBeGreaterThan(4);
    expect(first.items.some((word) => second.items.some((next) => next.id === word.id))).toBe(false);
    const school = repository.getVocabulary(1206730);
    expect(school.entry).toBe('学校');
    expect(school.audio).toContain('mana(bu)_06_h');
    expect(school.characters.map((character) => character.glyph)).toContain('学');
    expect(repository.getCharacterNames('kanji:23398').total).toBeGreaterThan(0);
    expect(repository.getCharacterSentences('kanji:23398').total).toBeGreaterThan(0);
  });
});

describe('source text parsing', () => {
  it('renders grouped furigana and supplementary characters without leaking markup', () => {
    expect(parseSentence('これ　は　{2ことし}今年　の　{しか}𠮟')).toEqual([{ text: 'これは' }, { text: '今年', reading: 'ことし' }, { text: 'の' }, { text: '𠮟', reading: 'しか' }]);
    expect(plainSentence('リンゴ　を　もう　{ひと}一つ　いかが　です　か。')).toBe('リンゴをもう一ついかがですか。');
    expect(cleanReading('!ガク!,*まな.ぶ')).toBe('ガク、まな.ぶ');
  });
  it('normalizes the entire sentence corpus without losing plain-text content', () => {
    for (const [source] of database.exec('SELECT text FROM sentence')[0].values) {
      const raw = String(source);
      expect(plainSentence(raw)).toBe(raw.replace(/\{[^}]*\}/g, '').replaceAll('\u3000', ''));
    }
  });
  it('preserves kana-only vocabulary and substitutes every gloss placeholder', () => {
    const kanaOnly = repository.getVocabulary(1000000);
    expect(vocabularyLabel(kanaOnly)).toBe('ヽ');
    const senses = repository.getVocabulary(1000090);
    expect(vocabularyMeaning(senses)).toContain('handakuten');
    expect(vocabularyMeaning(senses)).not.toMatch(/\[\d+\]/);
  });
});
