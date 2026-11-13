/**
 * Consistency of EVERY string table under src/i18n/strings/. The files are discovered with a glob,
 * so a namespace added later is checked automatically — nothing to register here.
 */
import { describe, expect, it } from 'vitest';
import { formatMessage, messageProblems, placeholderNames } from '../../src/i18n/index.ts';

const modules = import.meta.glob<{ default?: unknown }>('../../src/i18n/strings/*.ts', { eager: true });
const files = Object.keys(modules).sort();

type Dict = Record<string, unknown>;

function isPlainObject(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function tableOf(file: string): { en: Dict; ar: Dict } {
  const table = modules[file]!.default;
  if (!isPlainObject(table) || !isPlainObject(table.en) || !isPlainObject(table.ar)) {
    throw new Error(`${file} must default-export { en: {...}, ar: {...} }`);
  }
  return { en: table.en, ar: table.ar };
}

function shortName(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}

/** Numbers that reach every plural category of both languages. */
const SAMPLE_COUNTS = [0, 1, 2, 3, 7, 10, 11, 25, 99, 100, 101, 102, 103, 111, 1000, 12345];

/** An Arabic word standing on its own: optional one-letter prefixes and the article, optional pronoun / dual endings. */
function arabicWord(stems: string): RegExp {
  return new RegExp('(?<![\\u0621-\\u0652])[وفبكل]{0,2}(?:ال|لل)?(?:' + stems + ')(?:ك|ه|ها|نا|كم|ين|ان)?(?![\\u0621-\\u0652])');
}

/**
 * One Arabic word per concept, in every file. Each rule names synonyms that must not be used and
 * the word to use instead — the full vocabulary is at the top of src/i18n/strings/common.ts.
 */
const VOCABULARY: { avoid: RegExp; use: string }[] = [
  { avoid: arabicWord('أرواح|حيوات'), use: 'a life is قلب / قلوب' },
  // "حياة" only where it counts lives (next to a number, or "an extra / a free life") — the word itself is ordinary Arabic.
  { avoid: /(?:\d|\})\s*حياة|حياة\s*(?:إضافية|مجانية|واحدة|\{|\d)/, use: 'a life is قلب / قلوب' },
  { avoid: arabicWord('مستويات'), use: 'a level is مرحلة / مراحل' },
  { avoid: /المستوى\s*(?:\{|\d)/, use: 'a level is مرحلة ("المرحلة {n}")' },
  { avoid: arabicWord('نقلة|نقلات'), use: 'a move is حركة / حركات' },
  { avoid: /معز(?!\u0651)ز/, use: 'a booster is written معزّز, with the shadda' },
  { avoid: arabicWord('بوستر|بوسترات|تعزيزات'), use: 'a booster is معزّز / معزّزات' },
  { avoid: arabicWord('مصباح|مصابيح|قنديل|قناديل'), use: 'the lamp is فانوس / فوانيس' },
  { avoid: arabicWord('موشور|مواشير'), use: 'the prism is منشور' },
  { avoid: arabicWord('كوينز|كوين'), use: 'a coin is عملة / عملات' },
];

/** A "+" or "-" that starts the text or follows a space / bracket, directly before a digit or placeholder, without U+200E. */
const UNMARKED_SIGN = /(?:^|[\s(\[«"'])[+\-\u2212](?=\d|\{\w+\})/;

describe('the Arabic style rules themselves', () => {
  it('catch the synonyms and let the chosen words through', () => {
    const hits = (text: string): number => VOCABULARY.filter((rule) => rule.avoid.test(text)).length;
    for (const good of ['المرحلة {n}', 'القلوب مكتملة', 'قلب واحد', '{n} حركات', 'المعزّزات', 'معزّز مجاني', 'أنزل الفانوسين', 'منشور', 'عملاتك لا تكفي', 'مستوى الصوت', 'استمتع بالحياة']) {
      expect(hits(good), good).toBe(0);
    }
    for (const bad of ['الأرواح', 'أرواحك', 'حياة إضافية', '+1 حياة', '{n} حياة', 'حياة مجانية', 'المستويات', 'المستوى {n}', 'المستوى 5', '5 نقلات', 'نقلة واحدة', 'المعززات', 'معزز', 'بوستر', 'المصباح', 'مصابيح', 'القنديل', 'الموشور', 'كوينز']) {
      expect(hits(bad), bad).toBeGreaterThan(0);
    }
  });

  it('catch a sign that right-to-left text would draw after its number', () => {
    for (const bad of ['+{n}', '-{n}', '+25 عملة', 'احصل على +{n}', 'الرصيد (-5)', '\u2212{n}']) expect(UNMARKED_SIGN.test(bad), bad).toBe(true);
    for (const good of ['\u200E+{n}', '\u200E-{n}', 'احصل على \u200E+{n}', '{a}-{b}', '3-5', 'بـ 3 حركات', 'تبديل-حر', '{n, plural, one {x} other {y}}', '- ملاحظة']) {
      expect(UNMARKED_SIGN.test(good), good).toBe(false);
    }
  });
});

describe('string tables', () => {
  it('are found (at least the shared vocabulary)', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.map(shortName)).toContain('common.ts');
  });

  it('no key is defined in more than one file', () => {
    const owner: Record<string, string> = Object.create(null);
    const clashes: string[] = [];
    for (const file of files) {
      const { en, ar } = tableOf(file);
      const keys: Record<string, true> = Object.create(null);
      for (const key of Object.keys(en).concat(Object.keys(ar))) keys[key] = true;
      for (const key of Object.keys(keys)) {
        if (owner[key]) clashes.push(`"${key}" is in ${shortName(owner[key])} and ${shortName(file)}`);
        else owner[key] = file;
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe.each(files.map((file) => [shortName(file), file] as const))('strings/%s', (_name, file) => {
  it('default-exports a table with an "en" and an "ar" dictionary', () => {
    expect(() => tableOf(file)).not.toThrow();
    expect(Object.keys(tableOf(file).en).length).toBeGreaterThan(0);
  });

  it('has exactly the same keys in English and Arabic', () => {
    const { en, ar } = tableOf(file);
    const missingInArabic = Object.keys(en).filter((key) => !(key in ar));
    const missingInEnglish = Object.keys(ar).filter((key) => !(key in en));
    expect({ missingInArabic, missingInEnglish }).toEqual({ missingInArabic: [], missingInEnglish: [] });
  });

  it('has dotted keys without spaces', () => {
    const { en, ar } = tableOf(file);
    const bad = Object.keys(en)
      .concat(Object.keys(ar))
      .filter((key) => !/^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/.test(key));
    expect(bad).toEqual([]);
  });

  it('has no empty value', () => {
    const { en, ar } = tableOf(file);
    const bad: string[] = [];
    for (const [lang, dict] of [['en', en], ['ar', ar]] as const) {
      for (const key of Object.keys(dict)) {
        const value = dict[key];
        if (typeof value !== 'string') bad.push(`${lang} ${key}: not a string`);
        else if (value.trim().length === 0) bad.push(`${lang} ${key}: empty`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('uses the same {placeholders} in both languages', () => {
    const { en, ar } = tableOf(file);
    const bad: string[] = [];
    for (const key of Object.keys(en)) {
      const a = en[key];
      const b = ar[key];
      if (typeof a !== 'string' || typeof b !== 'string') continue; // reported by the tests above
      const inEn = placeholderNames(a).join(', ');
      const inAr = placeholderNames(b).join(', ');
      if (inEn !== inAr) bad.push(`${key}: en {${inEn}} ≠ ar {${inAr}}`);
    }
    expect(bad).toEqual([]);
  });

  it('has well-formed plural blocks', () => {
    const { en, ar } = tableOf(file);
    const bad: string[] = [];
    for (const [lang, dict] of [['en', en], ['ar', ar]] as const) {
      for (const key of Object.keys(dict)) {
        const value = dict[key];
        if (typeof value !== 'string') continue;
        for (const problem of messageProblems(value)) bad.push(`${lang} ${key}: ${problem}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('formats to clean text for any count (no braces or empty results left behind)', () => {
    const { en, ar } = tableOf(file);
    const bad: string[] = [];
    for (const [lang, dict] of [['en', en], ['ar', ar]] as const) {
      for (const key of Object.keys(dict)) {
        const value = dict[key];
        if (typeof value !== 'string') continue;
        const names = placeholderNames(value);
        if (names.length === 0 && value.indexOf('{') < 0) continue;
        for (const n of SAMPLE_COUNTS) {
          const vars: Record<string, number> = {};
          for (const name of names) vars[name] = n;
          const text = formatMessage(value, vars, lang);
          if (/[{}]/.test(text) || text.trim().length === 0) {
            bad.push(`${lang} ${key} with ${n}: "${text}"`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('Arabic uses one word per concept (the vocabulary at the top of strings/common.ts)', () => {
    const { ar } = tableOf(file);
    const bad: string[] = [];
    for (const key of Object.keys(ar)) {
      const value = ar[key];
      if (typeof value !== 'string') continue;
      for (const rule of VOCABULARY) {
        const hit = rule.avoid.exec(value);
        if (hit) bad.push(`ar ${key}: "${hit[0]}" — ${rule.use}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('Arabic keeps a sign on the correct side of its number (U+200E before a leading + or -)', () => {
    const { ar } = tableOf(file);
    const bad: string[] = [];
    for (const key of Object.keys(ar)) {
      const value = ar[key];
      if (typeof value === 'string' && UNMARKED_SIGN.test(value)) bad.push(`ar ${key}: write "\\u200E" before the sign in "${value}"`);
    }
    expect(bad).toEqual([]);
  });

  it('uses the punctuation of its language', () => {
    const { en, ar } = tableOf(file);
    const bad: string[] = [];
    for (const key of Object.keys(ar)) {
      const value = ar[key];
      if (typeof value !== 'string') continue;
      // A Latin comma, semicolon or question mark right after an Arabic letter: must be ، ؛ ؟
      const hit = /[\u0621-\u0652][,;?]/.exec(value);
      if (hit) bad.push(`ar ${key}: "${hit[0]}" — use the Arabic mark (، ؛ ؟)`);
    }
    for (const [lang, dict] of [['en', en], ['ar', ar]] as const) {
      for (const key of Object.keys(dict)) {
        const value = dict[key];
        if (typeof value === 'string' && value.indexOf('...') >= 0) bad.push(`${lang} ${key}: write the ellipsis as one character (…)`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('writes digits the Western way (0-9) in both languages', () => {
    const { en, ar } = tableOf(file);
    const bad: string[] = [];
    for (const [lang, dict] of [['en', en], ['ar', ar]] as const) {
      for (const key of Object.keys(dict)) {
        const value = dict[key];
        if (typeof value === 'string' && /[٠-٩۰-۹]/.test(value)) bad.push(`${lang} ${key}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
