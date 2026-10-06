/**
 * Text helpers shared by word entry (duplicate detection, search) and the quiz
 * (answer checking). Everything here is pure and unit-tested.
 */

const COMBINING_ACUTE = /\u0301/g; // stress mark learners type on Cyrillic: я́белка
const PUNCT_OR_SYMBOL = /[\p{P}\p{S}]/gu;
const WHITESPACE = /\s+/g;

/**
 * Canonical form used for comparison.
 * - Unicode NFC, lower case, trimmed, inner whitespace collapsed
 * - stress accents (U+0301) removed; meaningful marks such as й or ѝ are kept
 * - punctuation and symbols removed ("to go!" == "to go")
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_ACUTE, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(PUNCT_OR_SYMBOL, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

/**
 * Splits a field into accepted variants. Users separate alternatives with ";" or ",":
 * "хубав; красив" -> ["хубав", "красив"]. Empty parts and duplicates are dropped.
 */
export function splitVariants(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[;,]/)) {
    const v = raw.trim().replace(WHITESPACE, ' ');
    const key = normalize(v);
    if (!v || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function joinVariants(variants: string[]): string {
  return variants.join('; ');
}

/**
 * Levenshtein distance over Unicode code points.
 * Callers pass NFD strings so a Hangul syllable counts as its separate jamo,
 * meaning one wrong vowel in 사과 costs 1 edit rather than a whole syllable.
 */
export function levenshtein(a: string, b: string): number {
  const s = Array.from(a);
  const t = Array.from(b);
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  let curr = new Array<number>(t.length + 1);
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[t.length];
}

export type AnswerVerdict = 'correct' | 'almost' | 'wrong';

export interface AnswerCheck {
  verdict: AnswerVerdict;
  /** The accepted variant that matched (or the first variant when wrong). */
  expected: string;
}

/**
 * Checks a typed answer against all accepted variants.
 * Exact match after normalisation -> correct.
 * With typo tolerance on, one edit (on decomposed text, words of 4+ units) -> almost.
 */
export function checkAnswer(input: string, accepted: string[], typoTolerance: boolean): AnswerCheck {
  const given = normalize(input);
  if (accepted.length === 0) return { verdict: 'wrong', expected: '' };

  for (const variant of accepted) {
    if (normalize(variant) === given) return { verdict: 'correct', expected: variant };
  }

  if (typoTolerance && given) {
    const givenD = given.normalize('NFD');
    for (const variant of accepted) {
      const targetD = normalize(variant).normalize('NFD');
      const length = Array.from(targetD).length;
      if (length >= 4 && levenshtein(givenD, targetD) <= 1) {
        return { verdict: 'almost', expected: variant };
      }
    }
  }

  return { verdict: 'wrong', expected: accepted[0] };
}

/** Case-insensitive, accent-insensitive "contains" used by the word list search. */
export function matchesSearch(haystack: string[], query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return haystack.some((h) => normalize(h).includes(q));
}
