/**
 * i18n core: English + Arabic (RTL), instant switching.
 *
 * Strings live in ./strings/<namespace>.ts — every file default-exports a StringTable
 * (`{ en: {...}, ar: {...} }`, identical key sets). `createI18n` picks up every file in that folder
 * automatically, so adding a namespace never requires touching this module.
 *
 * Message syntax:
 *   {name}                         replaced by vars.name. Whole numbers are written with thousands
 *                                  separators and Western digits (1500 → "1,500"); pass a string to
 *                                  insert something verbatim. Unknown placeholders are left as they are.
 *   {n, plural, one {…} other {…}} picks a variant by the number in vars.n using the language's plural
 *                                  rules. English: one, other. Arabic: zero, one, two, few (3–10),
 *                                  many (11–99), other. `=0`, `=1` … match an exact number first.
 *                                  A missing category falls back to `other`. Variants may contain
 *                                  placeholders, e.g. "{n, plural, one {1 move} other {{n} moves}}".
 */
import type { I18nApi, Lang, StringTable } from './types.ts';

type Vars = Record<string, string | number>;

// ───────────────────────────── language detection ─────────────────────────────

/** 'ar' for any Arabic locale ("ar", "ar-SY", "ar_EG", "AR-sa" …), otherwise 'en'. */
export function detectLang(locale: string): Lang {
  return typeof locale === 'string' && /^ar(?:[-_]|$)/i.test(locale.trim()) ? 'ar' : 'en';
}

/** The language to start in: the player's saved choice, or the device language when there is none. */
export function resolveLang(saved: Lang | null | undefined, locale: string): Lang {
  return saved === 'en' || saved === 'ar' ? saved : detectLang(locale);
}

// ───────────────────────────── numbers & time ─────────────────────────────

/** 12345 → "12,345". Rounded to a whole number, Western digits in every language. */
export function formatNumber(n: number): string {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  const rounded = Math.round(n);
  const digits = String(Math.abs(rounded));
  if (digits.indexOf('e') >= 0) return String(rounded); // beyond 1e21: nothing sensible to group
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rounded < 0 ? '-' + grouped : grouped;
}

function two(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Milliseconds → "mm:ss" ("h:mm:ss" from one hour up). Meant for countdowns, so it rounds UP to
 * the next second: it shows "00:01" until the time is really over, and "20:00" for a full 20 minutes.
 */
export function formatClock(ms: number): string {
  const total = typeof ms === 'number' && isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? h + ':' + two(m) + ':' + two(s) : two(m) + ':' + two(s);
}

// ───────────────────────────── plural rules ─────────────────────────────

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** CLDR plural category of a number (cardinals). Hand-written so it never depends on ICU data. */
export function pluralCategory(lang: Lang, n: number): PluralCategory {
  if (typeof n !== 'number' || !isFinite(n)) return 'other';
  const abs = Math.abs(n);
  if (lang === 'ar') {
    if (abs === 0) return 'zero';
    if (abs === 1) return 'one';
    if (abs === 2) return 'two';
    if (abs !== Math.floor(abs)) return 'other';
    const mod = abs % 100;
    if (mod >= 3 && mod <= 10) return 'few';
    if (mod >= 11) return 'many';
    return 'other';
  }
  return abs === 1 ? 'one' : 'other';
}

// ───────────────────────────── message formatting ─────────────────────────────

const SIMPLE = /\{(\w+)\}/y;
const PLURAL_HEAD = /\{\s*(\w+)\s*,\s*plural\s*,/y;
const SELECTOR = /\s*(=\d+|\w+)\s*\{/y;

interface PluralBlock {
  name: string;
  /** selector → variant text, in source order */
  options: [string, string][];
  /** index just past the closing brace */
  end: number;
}

/** Parse a plural block starting at `start` (which holds '{'); null when the text there is not one. */
function parsePlural(src: string, start: number): PluralBlock | null {
  PLURAL_HEAD.lastIndex = start;
  const head = PLURAL_HEAD.exec(src);
  if (!head) return null;
  const options: [string, string][] = [];
  let i = PLURAL_HEAD.lastIndex;
  for (;;) {
    SELECTOR.lastIndex = i;
    const sel = SELECTOR.exec(src);
    if (!sel) break;
    // Read the variant up to its matching brace.
    let depth = 1;
    let j = SELECTOR.lastIndex;
    const bodyStart = j;
    while (j < src.length && depth > 0) {
      const ch = src.charCodeAt(j);
      if (ch === 123) depth++;
      else if (ch === 125) depth--;
      j++;
    }
    if (depth !== 0) return null; // unbalanced
    options.push([sel[1]!, src.slice(bodyStart, j - 1)]);
    i = j;
  }
  // Closing brace of the whole block (optional whitespace before it).
  while (i < src.length && /\s/.test(src.charAt(i))) i++;
  if (options.length === 0 || src.charAt(i) !== '}') return null;
  return { name: head[1]!, options, end: i + 1 };
}

function toNumber(v: string | number | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.replace(/,/g, '').trim();
    return s === '' ? NaN : Number(s);
  }
  return NaN;
}

function choose(block: PluralBlock, value: string | number | undefined, lang: Lang): string {
  const n = toNumber(value);
  const exact = '=' + n;
  const category = pluralCategory(lang, n);
  let other: string | undefined;
  let byCategory: string | undefined;
  for (const [sel, text] of block.options) {
    if (sel === exact) return text;
    if (sel === category && byCategory === undefined) byCategory = text;
    if (sel === 'other' && other === undefined) other = text;
  }
  if (byCategory !== undefined) return byCategory;
  if (other !== undefined) return other;
  return block.options[block.options.length - 1]![1];
}

function show(v: string | number): string {
  return typeof v === 'number' && v === Math.floor(v) ? formatNumber(v) : String(v);
}

/** Fill a message template (see the syntax at the top of this file). Never throws. */
export function formatMessage(template: string, vars: Vars | undefined, lang: Lang): string {
  if (template.indexOf('{') < 0) return template;
  let out = '';
  let i = 0;
  const len = template.length;
  while (i < len) {
    const open = template.indexOf('{', i);
    if (open < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    SIMPLE.lastIndex = open;
    const simple = SIMPLE.exec(template);
    if (simple) {
      const name = simple[1]!;
      const has = vars !== undefined && Object.prototype.hasOwnProperty.call(vars, name);
      out += has ? show(vars[name]!) : simple[0];
      i = SIMPLE.lastIndex;
      continue;
    }
    const block = parsePlural(template, open);
    if (block) {
      const has = vars !== undefined && Object.prototype.hasOwnProperty.call(vars, block.name);
      out += formatMessage(choose(block, has ? vars[block.name] : undefined, lang), vars, lang);
      i = block.end;
      continue;
    }
    out += '{';
    i = open + 1;
  }
  return out;
}

/**
 * Names of every variable a template uses — simple placeholders and plural selectors alike, across
 * all plural variants. Used to check that the two languages of a string agree.
 */
export function placeholderNames(template: string): string[] {
  const found: Record<string, true> = {};
  let m: RegExpExecArray | null;
  const simple = /\{(\w+)\}/g;
  while ((m = simple.exec(template))) found[m[1]!] = true;
  const plural = /\{\s*(\w+)\s*,\s*plural\s*,/g;
  while ((m = plural.exec(template))) found[m[1]!] = true;
  return Object.keys(found).sort();
}

// ───────────────────────────── tables ─────────────────────────────

function isTable(v: unknown): v is StringTable {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as { en?: unknown; ar?: unknown };
  return typeof t.en === 'object' && t.en !== null && typeof t.ar === 'object' && t.ar !== null;
}

function isDev(): boolean {
  try {
    // Replaced by a literal in Vite builds; under plain Node `import.meta.env` is undefined and this throws.
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
}

function warn(message: string): void {
  if (isDev() && typeof console !== 'undefined') console.warn('[i18n] ' + message);
}

/** Merge namespace tables into one. A key defined twice keeps the later definition (and warns in dev). */
export function mergeTables(tables: readonly StringTable[]): StringTable {
  const merged: StringTable = { en: Object.create(null), ar: Object.create(null) };
  for (const table of tables) {
    if (!isTable(table)) continue;
    for (const lang of ['en', 'ar'] as const) {
      const from = table[lang];
      const into = merged[lang];
      for (const key of Object.keys(from)) {
        const value = from[key];
        if (typeof value !== 'string') continue;
        if (key in into && into[key] !== value) warn('duplicate key "' + key + '" (' + lang + ')');
        into[key] = value;
      }
    }
  }
  return merged;
}

/** Every table under ./strings/ (bundled by Vite / Vitest). Empty when run without a bundler. */
function bundledTables(): StringTable[] {
  let modules: Record<string, { default?: unknown }>;
  try {
    modules = import.meta.glob<{ default?: unknown }>('./strings/*.ts', { eager: true });
  } catch {
    return []; // plain Node: import.meta.glob does not exist — use createI18nFromTables
  }
  const tables: StringTable[] = [];
  for (const path of Object.keys(modules).sort()) {
    const table = modules[path]!.default;
    if (isTable(table)) tables.push(table);
    else warn('"' + path + '" does not default-export a StringTable');
  }
  return tables;
}

// ───────────────────────────── the API ─────────────────────────────

function applyToDocument(lang: Lang): void {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  } catch {
    // no usable document: nothing to update
  }
}

/** Build the API from explicit tables (tests, Node tools). */
export function createI18nFromTables(tables: StringTable[], initial: Lang): I18nApi {
  const merged = mergeTables(tables);
  const listeners: { fn: (lang: Lang) => void }[] = [];
  const warned: Record<string, true> = Object.create(null);
  let current: Lang = initial === 'ar' ? 'ar' : 'en';
  applyToDocument(current);

  function lookup(lang: Lang, key: string): string | undefined {
    // The merged tables have no prototype, so "constructor" & co. are not found by accident.
    return merged[lang][key];
  }

  return {
    lang: () => current,

    setLang(lang: Lang): void {
      if (lang !== 'en' && lang !== 'ar') return;
      const changed = lang !== current;
      current = lang;
      applyToDocument(current);
      if (!changed) return;
      for (const entry of listeners.slice()) {
        if (listeners.indexOf(entry) < 0) continue;
        try {
          entry.fn(current);
        } catch (err) {
          if (typeof console !== 'undefined') console.error('[i18n] listener failed', err);
        }
      }
    },

    isRtl: () => current === 'ar',

    t(key: string, vars?: Vars): string {
      let template = lookup(current, key);
      if (template === undefined) {
        // Missing in this language only: better the other language than a raw key.
        template = lookup(current === 'ar' ? 'en' : 'ar', key);
        if (!warned[key]) {
          warned[key] = true;
          warn('missing ' + (template === undefined ? 'key' : 'translation (' + current + ') for') + ' "' + key + '"');
        }
        if (template === undefined) return key;
      }
      return formatMessage(template, vars, current);
    },

    num: formatNumber,
    clock: formatClock,

    onChange(listener: (lang: Lang) => void): () => void {
      const entry = { fn: listener };
      listeners.push(entry);
      return () => {
        const i = listeners.indexOf(entry);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
}

/** The game's i18n: every namespace file under ./strings/, starting in `initial`. */
export function createI18n(initial: Lang): I18nApi {
  return createI18nFromTables(bundledTables(), initial);
}
