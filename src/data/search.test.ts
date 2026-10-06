import { describe, expect, it } from 'vitest';
import { parseSearch } from './search';

describe('documented search syntax', () => {
  it('keeps phrases together and applies exclusions and character filters', () => {
    const query = parseSearch('N5 8 "study of" -science -n1 strokes:12', 'character');
    expect(query.jlpt).toEqual([{ value: 5, excluded: false }, { value: 1, excluded: true }]);
    expect(query.strokes).toEqual([{ value: 8, excluded: false }, { value: 12, excluded: false }]);
    expect(query.terms).toEqual([{ text: 'study of', excluded: false, meaningOnly: true }, { text: 'science', excluded: true, meaningOnly: false }]);
  });
  it('parses word flags and POS while retaining numeric words as text', () => {
    const query = parseSearch('学校 24 common -has:audio jlpt:n5 pos:adj-i', 'vocabulary');
    expect(query.flags).toEqual([{ value: 'common', excluded: false }, { value: 'audio', excluded: true }]);
    expect(query.partsOfSpeech).toEqual([{ value: ['adji'], excluded: false }]);
    expect(query.terms.map((term) => term.text)).toEqual(['学校', '24']);
  });
  it('supports unclassified JLPT and treats quoted reserved words literally', () => {
    expect(parseSearch('n? "common" -"with audio"', 'vocabulary')).toMatchObject({ jlpt: [{ value: 0, excluded: false }], flags: [], terms: [{ text: 'common', excluded: false, meaningOnly: true }, { text: 'with audio', excluded: true, meaningOnly: true }] });
  });
});
