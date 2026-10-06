export interface Language {
  code: string;
  name: string;
  native: string;
}

const EXAMPLES: Record<string, string> = {
  bg: 'ябълка',
  ko: '사과',
  en: 'apple',
  de: 'der Apfel',
  fr: 'la pomme',
  es: 'la manzana',
  it: 'la mela',
  pt: 'a maçã',
  ru: 'яблоко',
  uk: 'яблуко',
  ja: 'りんご',
  zh: '苹果',
  el: 'μήλο',
  tr: 'elma',
  pl: 'jabłko',
  sr: 'јабука',
  mk: 'јаболко',
};

/** A sample word used as input placeholder (empty when we have none for the language). */
export function exampleWord(code: string): string {
  return EXAMPLES[code] ?? '';
}

/** Languages offered in the picker. `code` is a BCP-47 tag used for the inputs' lang attribute. */
export const LANGUAGES: Language[] = [
  { code: 'bg', name: 'Bulgarian', native: 'български' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'fr', name: 'French', native: 'français' },
  { code: 'es', name: 'Spanish', native: 'español' },
  { code: 'it', name: 'Italian', native: 'italiano' },
  { code: 'pt', name: 'Portuguese', native: 'português' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'pl', name: 'Polish', native: 'polski' },
  { code: 'cs', name: 'Czech', native: 'čeština' },
  { code: 'ro', name: 'Romanian', native: 'română' },
  { code: 'el', name: 'Greek', native: 'ελληνικά' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'sr', name: 'Serbian', native: 'српски' },
  { code: 'mk', name: 'Macedonian', native: 'македонски' },
  { code: 'ru', name: 'Russian', native: 'русский' },
  { code: 'uk', name: 'Ukrainian', native: 'українська' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'sv', name: 'Swedish', native: 'svenska' },
  { code: 'fi', name: 'Finnish', native: 'suomi' },
];

export function languageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();
}

const RTL = new Set(['ar', 'he', 'fa', 'ur']);
export function textDirection(code: string): 'rtl' | 'ltr' {
  return RTL.has(code) ? 'rtl' : 'ltr';
}
