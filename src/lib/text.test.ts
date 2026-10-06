import { describe, expect, it } from 'vitest';
import { checkAnswer, levenshtein, matchesSearch, normalize, splitVariants } from './text';

describe('normalize', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalize('  Добро   УТРО ')).toBe('добро утро');
  });
  it('removes stress accents but keeps й and ѝ', () => {
    expect(normalize('я́бълка')).toBe('ябълка');
    expect(normalize('край')).toBe('край');
    expect(normalize('ѝ')).not.toBe(normalize('и'));
  });
  it('removes punctuation', () => {
    expect(normalize('Здравей!')).toBe('здравей');
    expect(normalize('안녕하세요?')).toBe('안녕하세요');
  });
  it('treats composed and decomposed Hangul the same', () => {
    expect(normalize('사과'.normalize('NFD'))).toBe(normalize('사과'));
  });
});

describe('splitVariants', () => {
  it('splits on ; and , and drops duplicates', () => {
    expect(splitVariants('хубав; красив, Хубав ; ')).toEqual(['хубав', 'красив']);
  });
  it('returns empty array for blank input', () => {
    expect(splitVariants('   ')).toEqual([]);
  });
});

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
  it('counts one wrong Hangul vowel as one edit on NFD text', () => {
    expect(levenshtein('사과'.normalize('NFD'), '사고'.normalize('NFD'))).toBe(1);
  });
});

describe('checkAnswer', () => {
  it('accepts any variant exactly', () => {
    expect(checkAnswer('Красив', ['хубав', 'красив'], false)).toEqual({ verdict: 'correct', expected: 'красив' });
  });
  it('flags a one-letter typo as almost when tolerance is on', () => {
    expect(checkAnswer('ябалка', ['ябълка'], true).verdict).toBe('almost');
    expect(checkAnswer('ябалка', ['ябълка'], false).verdict).toBe('wrong');
  });
  it('does not allow typos on very short words', () => {
    expect(checkAnswer('да', ['не'], true).verdict).toBe('wrong');
  });
  it('flags one wrong jamo in Korean as almost', () => {
    expect(checkAnswer('사고', ['사과'], true).verdict).toBe('almost');
  });
  it('rejects empty answers', () => {
    expect(checkAnswer('', ['ябълка'], true).verdict).toBe('wrong');
  });
});

describe('matchesSearch', () => {
  it('matches across variants, ignoring case and stress', () => {
    expect(matchesSearch(['Я́белка', 'apple'], 'ябел')).toBe(true);
    expect(matchesSearch(['사과'], '과')).toBe(true);
    expect(matchesSearch(['сирене'], 'мляко')).toBe(false);
  });
});
