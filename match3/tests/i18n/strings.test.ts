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
