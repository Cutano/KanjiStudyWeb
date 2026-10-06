/** The catalog's reading markers remain in raw fields; only presentation removes them. */
export function cleanReading(text: string): string {
  return text.replace(/[!*]/g, '').replaceAll(',', '、');
}
export function vocabularyLabel(word: { entry: string; readings: string }): string {
  return word.entry.split('|')[0] || word.readings.split(';')[0].split(',')[0] || '';
}
export function vocabularyMeaning(word: { meanings: string; meaningsTemplate: string }): string {
  const meanings = word.meanings.split('|');
  return word.meaningsTemplate.replace(/\[(\d+)\]/g, (original, ordinal: string) => meanings[Number(ordinal) - 1] ?? original);
}
export interface RubySegment { text: string; reading?: string }

/** Braced readings precede one glyph, or the explicit number of following glyphs. */
export function parseSentence(source: string): RubySegment[] {
  const characters = Array.from(source);
  const segments: RubySegment[] = [];
  let plain = '';
  const flush = () => { if (plain) { segments.push({ text: plain }); plain = ''; } };
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (character === '\u3000') continue;
    if (character !== '{') { plain += character; continue; }
    const end = characters.indexOf('}', index + 1);
    if (end === -1) { plain += character; continue; }
    const annotation = characters.slice(index + 1, end).join('');
    const match = /^(\d+)?(.+)$/.exec(annotation);
    if (!match) { plain += characters.slice(index, end + 1).join(''); index = end; continue; }
    const length = Number(match[1] || 1);
    const text = characters.slice(end + 1, end + 1 + length).join('');
    flush();
    segments.push({ text, reading: match[2] });
    index = end + length;
  }
  flush();
  return segments;
}
export function plainSentence(source: string): string {
  return parseSentence(source).map((segment) => segment.text).join('');
}
