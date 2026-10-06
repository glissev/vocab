import Papa from 'papaparse';
import { joinVariants, splitVariants } from './text';
import type { Entry, EntryDraft } from './types';

/**
 * CSV layout (one word per row):
 *   column 1: language A (variants separated by ";")
 *   column 2: language B
 *   column 3: note (optional)
 *   column 4: tags separated by spaces or "|" (optional)
 * Export adds a UTF-8 BOM so Excel shows Cyrillic, Hangul etc. correctly.
 */
export function entriesToCsv(entries: Entry[], langA: string, langB: string): string {
  const rows = entries.map((e) => [joinVariants(e.a), joinVariants(e.b), e.note, e.tags.join(' | ')]);
  const csv = Papa.unparse({ fields: [langA, langB, 'note', 'tags'], data: rows }, { newline: '\r\n' });
  return '\uFEFF' + csv;
}

export interface ParsedImport {
  rows: EntryDraft[];
  skippedEmpty: number;
}

export function parseImport(text: string, hasHeader: boolean): ParsedImport {
  const clean = text.replace(/^\uFEFF/, '');
  const result = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' });
  const data = hasHeader ? result.data.slice(1) : result.data;
  const rows: EntryDraft[] = [];
  let skippedEmpty = 0;
  for (const cols of data) {
    const a = splitVariants(cols[0] ?? '');
    const b = splitVariants(cols[1] ?? '');
    if (a.length === 0 && b.length === 0) {
      skippedEmpty++;
      continue;
    }
    const tags = (cols[3] ?? '')
      .split(/[|\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    rows.push({ a, b, note: (cols[2] ?? '').trim(), tags: Array.from(new Set(tags)) });
  }
  return { rows, skippedEmpty };
}

/** Heuristic: the first row looks like a header if it names a language code or "note". */
export function looksLikeHeader(text: string, langA: string, langB: string): boolean {
  const first = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { preview: 1 }).data[0] ?? [];
  const cells = first.map((c) => c.trim().toLowerCase());
  return cells.includes(langA.toLowerCase()) || cells.includes(langB.toLowerCase()) || cells.includes('note');
}
