import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TranslateError,
  apiLang,
  autoTranslatePlan,
  cleanTranslation,
  clearTranslationCache,
  parseMyMemory,
  queryFor,
  translateWord,
} from './translate';

describe('autoTranslatePlan', () => {
  it('translates into an empty other side', () => {
    expect(autoTranslatePlan('a', 'ябълка', '', null)).toBe('translate');
    expect(autoTranslatePlan('b', '사과', '  ', null)).toBe('translate');
  });
  it('replaces an untouched auto-translation', () => {
    expect(autoTranslatePlan('a', 'ябълки', '사과', { side: 'b', value: '사과' })).toBe('translate');
  });
  it('never overwrites text the user typed', () => {
    expect(autoTranslatePlan('a', 'ябълка', '사과', null)).toBe('none');
    expect(autoTranslatePlan('a', 'ябълка', '사과나무', { side: 'b', value: '사과' })).toBe('none');
  });
  it('clears the auto-translation when the source is emptied', () => {
    expect(autoTranslatePlan('a', '', '사과', { side: 'b', value: '사과' })).toBe('clear');
    expect(autoTranslatePlan('a', ' ; ', '', null)).toBe('none');
  });
});

describe('queryFor and apiLang', () => {
  it('uses the first variant', () => {
    expect(queryFor(' хубав; красив')).toBe('хубав');
    expect(queryFor('')).toBe('');
  });
  it('maps Chinese to a region code', () => {
    expect(apiLang('zh')).toBe('zh-CN');
    expect(apiLang('ko')).toBe('ko');
  });
});

describe('cleanTranslation', () => {
  it('lower-cases a capital the source did not have', () => {
    expect(cleanTranslation('Ябълка.', '사과', 'bg')).toBe('ябълка');
    expect(cleanTranslation('Apple', 'ябълка', 'en')).toBe('apple');
  });
  it('keeps capitals for German, acronyms and capitalised sources', () => {
    expect(cleanTranslation('Apfel', 'ябълка', 'de')).toBe('Apfel');
    expect(cleanTranslation('USA', 'сащ', 'en')).toBe('USA');
    expect(cleanTranslation('Seoul', 'Сеул', 'en')).toBe('Seoul');
  });
  it('decodes entities and strips quotes', () => {
    expect(cleanTranslation('&quot;it&#39;s&quot;', 'това е', 'en')).toBe("it's");
  });
});

describe('parseMyMemory', () => {
  const ok = (translatedText: string, matches: unknown[] = []) => ({
    responseStatus: 200,
    responseData: { translatedText },
    matches,
  });

  it('returns the main translation first, then matching alternatives', () => {
    const data = ok('사과', [
      { segment: 'ябълка', translation: '사과', match: 1 },
      { segment: 'Ябълка', translation: '애플', match: 0.9 },
      { segment: 'ябълково дърво', translation: '사과나무', match: 0.7 },
    ]);
    expect(parseMyMemory(data, 'ябълка', 'ko')).toEqual(['사과', '애플']);
  });
  it('drops an untranslated echo of the query', () => {
    expect(() => parseMyMemory(ok('ябълка'), 'ябълка', 'ko')).toThrow(TranslateError);
  });
  it('reports the daily limit', () => {
    const data = ok('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.');
    expect(() => parseMyMemory(data, 'ябълка', 'ko')).toThrow(/daily limit/);
    expect(() => parseMyMemory({ responseStatus: '429' }, 'x', 'ko')).toThrow(/daily limit/);
  });
  it('reports an unsupported language pair', () => {
    const data = { responseStatus: 403, responseDetails: "'XX' IS AN INVALID TARGET LANGUAGE" };
    expect(() => parseMyMemory(data, 'ябълка', 'xx')).toThrow(/language pair/);
  });
});

describe('translateWord', () => {
  beforeEach(() => clearTranslationCache());

  it('calls MyMemory once per word and caches the result', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: '사과' } })));
    expect(await translateWord('ябълка; ябълки', 'bg', 'ko', undefined, fetchImpl)).toEqual(['사과']);
    expect(await translateWord('Ябълка', 'bg', 'ko', undefined, fetchImpl)).toEqual(['사과']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('q')).toBe('ябълка');
    expect(url.searchParams.get('langpair')).toBe('bg|ko');
  });
  it('turns network failures into a readable error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(translateWord('ябълка', 'bg', 'ko', undefined, fetchImpl)).rejects.toMatchObject({ kind: 'network' });
  });
});
