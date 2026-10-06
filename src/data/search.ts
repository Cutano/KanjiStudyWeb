export interface SearchTerm { text: string; excluded: boolean; meaningOnly: boolean }
export interface SearchFilter<T> { value: T; excluded: boolean }
export interface ParsedSearch {
  terms: SearchTerm[];
  jlpt: SearchFilter<number>[];
  strokes: SearchFilter<number>[];
  flags: SearchFilter<'common' | 'audio'>[];
  partsOfSpeech: SearchFilter<string[]>[];
}
const verbTags = ['v1', 'v1s', 'v2as', 'v2bk', 'v2ds', 'v2gk', 'v2gs', 'v2hk', 'v2hs', 'v2kk', 'v2ks', 'v2ms', 'v2ns', 'v2rk', 'v2rs', 'v2ss', 'v2tk', 'v2ts', 'v2ws', 'v2yk', 'v2ys', 'v2zs', 'v4b', 'v4g', 'v4h', 'v4k', 'v4m', 'v4r', 'v4s', 'v4t', 'v5aru', 'v5b', 'v5g', 'v5k', 'v5ks', 'v5m', 'v5n', 'v5r', 'v5ri', 'v5s', 'v5t', 'v5u', 'v5us', 'vk', 'vn', 'vr', 'vs', 'vsc', 'vsi', 'vss', 'vz'];
const aliases: Record<string, string[]> = {
  noun: ['n'], verb: verbTags, adjective: ['adji', 'adjix', 'adjna', 'adjno', 'adjf', 'adjt', 'adjpn', 'adjnari', 'adjku', 'adjshiku'],
  adverb: ['adv', 'advto'], expression: ['exp'], pronoun: ['pn'], particle: ['prt'], conjunction: ['conj'],
};

/** Parse a small, documented search language; unrecognized tokens remain literal terms. */
export function parseSearch(query: string, domain: 'character' | 'vocabulary'): ParsedSearch {
  const parsed: ParsedSearch = { terms: [], jlpt: [], strokes: [], flags: [], partsOfSpeech: [] };
  for (const match of query.matchAll(/(-?)(?:"([^"]*)"|(\S+))/gu)) {
    const excluded = match[1] === '-';
    const quoted = match[2] !== undefined;
    const value = (match[2] ?? match[3]).trim().toLowerCase();
    if (!value) continue;
    if (quoted) { parsed.terms.push({ text: value, excluded, meaningOnly: true }); continue; }
    const jlpt = /^(?:n|jlpt:n?)([1-5?])$/.exec(value);
    if (jlpt) { parsed.jlpt.push({ value: jlpt[1] === '?' ? 0 : Number(jlpt[1]), excluded }); continue; }
    const strokes = /^(?:(?:strokes?|s):)?(\d{1,2})$/.exec(value);
    if (domain === 'character' && strokes) { parsed.strokes.push({ value: Number(strokes[1]), excluded }); continue; }
    if (domain === 'vocabulary') {
      const flag = /^(?:(?:is|has):)?(common|audio)(?::(true|false))?$/.exec(value);
      if (flag) { parsed.flags.push({ value: flag[1] as 'common' | 'audio', excluded: flag[2] === 'false' ? !excluded : excluded }); continue; }
      const pos = /^pos:([a-z][a-z0-9-]*)$/.exec(value);
      if (pos) { parsed.partsOfSpeech.push({ value: aliases[pos[1]] ?? [pos[1].replaceAll('-', '')], excluded }); continue; }
    }
    parsed.terms.push({ text: value, excluded, meaningOnly: false });
  }
  return parsed;
}
