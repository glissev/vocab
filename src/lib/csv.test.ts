import { describe, expect, it } from 'vitest';
import { entriesToCsv, looksLikeHeader, parseImport } from './csv';
import type { Entry } from './types';

const sample: Entry = {
  id: '1',
  a: ['хубав', 'красив'],
  b: ['예쁘다'],
  aNorm: [],
  bNorm: [],
  note: 'adjective, "nice"',
  tags: ['adj', 'basic'],
  createdAt: 0,
  updatedAt: 0,
  review: {},
};

describe('csv', () => {
  it('round-trips through export and import', () => {
    const csv = entriesToCsv([sample], 'bg', 'ko');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const parsed = parseImport(csv, true);
    expect(parsed.rows).toEqual([{ a: ['хубав', 'красив'], b: ['예쁘다'], note: 'adjective, "nice"', tags: ['adj', 'basic'] }]);
  });

  it('accepts tab-separated text pasted from a spreadsheet', () => {
    const parsed = parseImport('ябълка\t사과\nкруша\t배\n\t\n', false);
    expect(parsed.rows.map((r) => [r.a[0], r.b[0]])).toEqual([
      ['ябълка', '사과'],
      ['круша', '배'],
    ]);
  });

  it('detects a header row', () => {
    expect(looksLikeHeader('bg,ko\nа,б', 'bg', 'ko')).toBe(true);
    expect(looksLikeHeader('ябълка,사과', 'bg', 'ko')).toBe(false);
  });
});
