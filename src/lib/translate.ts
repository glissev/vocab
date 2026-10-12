import { normalize, splitVariants } from './text';

/**
 * Automatic translation for the word form.
 *
 * Uses the free MyMemory API (https://mymemory.translated.net/doc/spec.php): no key, CORS-enabled,
 * about 5,000 characters a day per IP address. Nothing here needs a backend or the Blaze plan.
 */

export type Side = 'a' | 'b';

/** A value the app wrote into a side by itself. It stays "auto" until the user edits that side. */
export interface AutoFill {
  side: Side;
  value: string;
}

export type TranslateErrorKind = 'quota' | 'network' | 'none' | 'unsupported' | 'other';

export class TranslateError extends Error {
  constructor(
    public kind: TranslateErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'TranslateError';
  }
}

export function otherSide(side: Side): Side {
  return side === 'a' ? 'b' : 'a';
}

/**
 * What typing in `changed` should do to the other side:
 * - `translate` when the other side is empty or still holds an untouched auto-translation,
 * - `clear` when the source was emptied and the other side only holds an auto-translation,
 * - `none` when the user typed the other side themselves (never overwrite their text).
 */
export function autoTranslatePlan(
  changed: Side,
  sourceText: string,
  otherText: string,
  auto: AutoFill | null,
): 'translate' | 'clear' | 'none' {
  const other = otherSide(changed);
  const otherIsAuto = auto !== null && auto.side === other && auto.value === otherText;
  const otherIsFree = otherText.trim() === '' || otherIsAuto;
  if (!otherIsFree) return 'none';
  if (queryFor(sourceText) === '') return otherIsAuto ? 'clear' : 'none';
  return 'translate';
}

/** The text sent for translation: the first variant only ("хубав; красив" → "хубав"). */
export function queryFor(text: string): string {
  return (splitVariants(text)[0] ?? '').slice(0, 100);
}

/** MyMemory language codes. Most app codes work as they are. */
export function apiLang(code: string): string {
  const map: Record<string, string> = { zh: 'zh-CN' };
  return map[code] ?? code;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const n = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function isUpper(ch: string | undefined): boolean {
  return !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

/**
 * Tidy a raw translation: decode HTML entities, drop quotes and sentence punctuation, and lower-case
 * a capital first letter the source word did not have ("Ябълка" for "사과" → "ябълка").
 * German keeps its capitals because nouns are capitalised.
 */
export function cleanTranslation(raw: string, query: string, target: string): string {
  let s = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  s = s.replace(/^["'“”„«»「」]+|["'“”„«»「」]+$/g, '').trim();
  s = s.replace(/[.!?。！？]+$/u, '').trim();
  const chars = Array.from(s);
  if (target !== 'de' && !isUpper(Array.from(query)[0]) && isUpper(chars[0]) && !isUpper(chars[1])) {
    chars[0] = chars[0].toLowerCase();
    s = chars.join('');
  }
  return s;
}

interface MyMemoryMatch {
  segment?: unknown;
  translation?: unknown;
  match?: unknown;
}

interface MyMemoryResponse {
  responseStatus?: unknown;
  responseDetails?: unknown;
  responseData?: { translatedText?: unknown };
  matches?: unknown;
}

const QUOTA_MESSAGE = 'The free translation service’s daily limit is used up. Type the translation yourself, or try again tomorrow.';

/**
 * Turn a MyMemory /get response into translations, best first (at most 4, no duplicates,
 * no echo of the query). Throws TranslateError when there is nothing usable.
 */
export function parseMyMemory(data: unknown, query: string, target: string): string[] {
  const res = (data ?? {}) as MyMemoryResponse;
  const status = Number(res.responseStatus);
  const details = typeof res.responseDetails === 'string' ? res.responseDetails : '';
  const main = typeof res.responseData?.translatedText === 'string' ? res.responseData.translatedText : '';

  if (status === 429 || /MYMEMORY WARNING|USED ALL AVAILABLE FREE TRANSLATIONS/i.test(main + details)) {
    throw new TranslateError('quota', QUOTA_MESSAGE);
  }
  if (status !== 200) {
    if (/INVALID (SOURCE|TARGET) LANGUAGE|LANGPAIR/i.test(details)) {
      throw new TranslateError('unsupported', 'Automatic translation isn’t available for this language pair.');
    }
    throw new TranslateError('other', 'Couldn’t translate this word. Type the translation yourself.');
  }

  const qNorm = normalize(query);
  const matches = (Array.isArray(res.matches) ? (res.matches as MyMemoryMatch[]) : [])
    .filter((m) => typeof m.translation === 'string' && typeof m.segment === 'string' && normalize(m.segment) === qNorm)
    .sort((x, y) => Number(y.match ?? 0) - Number(x.match ?? 0))
    .map((m) => m.translation as string);

  const out: string[] = [];
  const seen = new Set<string>([qNorm]);
  for (const raw of [main, ...matches]) {
    const clean = cleanTranslation(raw, query, target);
    const key = normalize(clean);
    if (!key || clean.length > 60 || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length === 4) break;
  }
  if (out.length === 0) throw new TranslateError('none', 'No translation found. Type it yourself.');
  return out;
}

export function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

const cache = new Map<string, string[]>();

/** Translate one word or short phrase. Results are cached for the session. */
export async function translateWord(
  text: string,
  from: string,
  to: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const query = queryFor(text);
  if (!query) return [];
  const key = `${from}|${to}|${normalize(query)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = new URLSearchParams({ q: query, langpair: `${apiLang(from)}|${apiLang(to)}` });
  let data: unknown;
  try {
    const res = await fetchImpl(`https://api.mymemory.translated.net/get?${params}`, { signal });
    if (res.status === 429) throw new TranslateError('quota', QUOTA_MESSAGE);
    data = await res.json();
  } catch (err) {
    if (err instanceof TranslateError || isAbort(err)) throw err;
    throw new TranslateError('network', 'Couldn’t reach the translation service. Check your connection.');
  }
  const result = parseMyMemory(data, query, to);
  cache.set(key, result);
  return result;
}

/** For tests. */
export function clearTranslationCache() {
  cache.clear();
}
