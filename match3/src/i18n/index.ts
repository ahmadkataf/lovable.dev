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
 *                                  insert something verbatim. Unknown placeholders (and variables
 *                                  that are null / undefined) are left as they are.
 *   {n, plural, one {…} other {…}} picks a variant by the number in vars.n using the language's plural
 *                                  rules. English: one, other. Arabic: zero, one, two, few (3–10),
 *                                  many (11–99), other. `=0`, `=1` … match an exact number first.
 *                                  A missing category falls back to `other`; so does a negative
 *                                  number (variants such as "1 move" spell their number out and
 *                                  would hide the sign). Variants may contain placeholders, e.g.
 *                                  "{n, plural, one {1 move} other {{n} moves}}".
 *
 * Right-to-left text and signs: in Arabic a leading "-" or "+" is drawn on the wrong side of its
 * number ("5-") unless a left-to-right mark (U+200E) stands before it. `num()` and `t()` add that
 * mark themselves for negative numbers while the language is Arabic; a sign written by hand needs it
 * in the Arabic string ("\u200E+{n}") — tests/i18n/strings.test.ts checks this. Thousands separators,
 * "mm:ss" and "3/5" need nothing: the bidi algorithm keeps them together.
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

/**
 * 12345 → "12,345". Rounded to a whole number, Western digits in every language.
 * Not a number ⇒ "0"; ±Infinity ⇒ "∞" / "-∞" (never "0": an unbounded price must not look free).
 */
export function formatNumber(n: number): string {
  if (typeof n !== 'number' || n !== n) return '0';
  if (n === Infinity) return '∞';
  if (n === -Infinity) return '-∞';
  const rounded = Math.round(n);
  const digits = String(Math.abs(rounded));
  if (digits.indexOf('e') >= 0) return String(rounded); // beyond 1e21: nothing sensible to group
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rounded < 0 ? '-' + grouped : grouped;
}

/** U+200E LEFT-TO-RIGHT MARK. */
const LRM = '\u200E';

/**
 * A formatted number made safe for the language's text direction: in Arabic a leading minus gets a
 * left-to-right mark in front, so it stays on the left of its digits (see the file header).
 */
function directed(text: string, lang: Lang): string {
  return lang === 'ar' && text.charCodeAt(0) === 45 /* - */ ? LRM + text : text;
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

/**
 * CLDR plural category of a count (cardinals). Hand-written so it never depends on ICU data.
 * Counts are never negative; a negative number (and anything that is not a number) is 'other', so
 * that a variant with its number spelled out ("1 day") can never be shown for −1.
 */
export function pluralCategory(lang: Lang, n: number): PluralCategory {
  if (typeof n !== 'number' || !isFinite(n) || n < 0) return 'other';
  if (lang === 'ar') {
    if (n === 0) return 'zero';
    if (n === 1) return 'one';
    if (n === 2) return 'two';
    if (n !== Math.floor(n)) return 'other';
    const mod = n % 100;
    if (mod >= 3 && mod <= 10) return 'few';
    if (mod >= 11) return 'many';
    return 'other';
  }
  return n === 1 ? 'one' : 'other';
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

function show(v: unknown, lang: Lang): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') {
    // Whole numbers (and ±Infinity) get separators; NaN and fractions are shown as they are.
    return directed(v === Math.floor(v) ? formatNumber(v) : String(v), lang);
  }
  try {
    return String(v);
  } catch {
    return ''; // an object that cannot be turned into text
  }
}

/** The value for a placeholder, or undefined when the variable is missing (also null / undefined). */
function variable(vars: Vars | undefined, name: string): string | number | undefined {
  if (vars === undefined || vars === null || !Object.prototype.hasOwnProperty.call(vars, name)) return undefined;
  const v = vars[name];
  return v === null ? undefined : v;
}

/**
 * Plural blocks may contain plural blocks, but only this deep; anything nested further is left as
 * text. Real strings need one level, two at most — the limit keeps hostile input cheap and finite.
 */
const MAX_NESTING = 8;

/** Fill a message template (see the syntax at the top of this file). Never throws. */
export function formatMessage(template: string, vars: Vars | undefined, lang: Lang): string {
  if (typeof template !== 'string') return '';
  try {
    return fill(template, vars, lang, 0);
  } catch {
    return template; // nothing known reaches this; if something does, the raw text beats an exception
  }
}

function fill(template: string, vars: Vars | undefined, lang: Lang, depth: number): string {
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
      const value = variable(vars, simple[1]!);
      i = SIMPLE.lastIndex; // read before `show`, which may run foreign code (toString) that formats too
      out += value === undefined ? simple[0] : show(value, lang);
      continue;
    }
    const block = parsePlural(template, open);
    if (block) {
      const variant = choose(block, variable(vars, block.name), lang);
      out += depth < MAX_NESTING ? fill(variant, vars, lang, depth + 1) : variant;
      i = block.end;
      continue;
    }
    out += '{';
    i = open + 1;
  }
  return out;
}

function collectNames(template: string, into: Record<string, true>, depth: number): void {
  let i = 0;
  for (;;) {
    const open = template.indexOf('{', i);
    if (open < 0) return;
    SIMPLE.lastIndex = open;
    const simple = SIMPLE.exec(template);
    if (simple) {
      into[simple[1]!] = true;
      i = SIMPLE.lastIndex;
      continue;
    }
    const block = parsePlural(template, open);
    if (block) {
      into[block.name] = true;
      if (depth < MAX_NESTING) for (const option of block.options) collectNames(option[1], into, depth + 1);
      i = block.end;
      continue;
    }
    i = open + 1;
  }
}

/**
 * Names of every variable a template uses — simple placeholders and plural selectors alike, across
 * all plural variants. Used to check that the two languages of a string agree.
 */
export function placeholderNames(template: string): string[] {
  const found: Record<string, true> = Object.create(null);
  if (typeof template === 'string') collectNames(template, found, 0);
  return Object.keys(found).sort();
}

const CATEGORIES: readonly string[] = ['zero', 'one', 'two', 'few', 'many', 'other'];

function collectProblems(template: string, into: string[], depth: number): void {
  let i = 0;
  for (;;) {
    const open = template.indexOf('{', i);
    if (open < 0) return;
    SIMPLE.lastIndex = open;
    if (SIMPLE.exec(template)) {
      i = SIMPLE.lastIndex;
      continue;
    }
    const block = parsePlural(template, open);
    if (!block) {
      PLURAL_HEAD.lastIndex = open;
      if (PLURAL_HEAD.exec(template)) into.push('malformed plural block for "' + template.slice(open, open + 24) + '…"');
      i = open + 1;
      continue;
    }
    const seen: Record<string, true> = Object.create(null);
    if (depth >= MAX_NESTING) into.push('plural blocks are nested too deeply (more than ' + MAX_NESTING + ' levels)');
    for (const [selector, text] of block.options) {
      if (seen[selector]) into.push('plural variant "' + selector + '" is defined twice');
      seen[selector] = true;
      if (selector.charAt(0) !== '=' && CATEGORIES.indexOf(selector) < 0) into.push('unknown plural variant "' + selector + '"');
      if (depth < MAX_NESTING) collectProblems(text, into, depth + 1);
    }
    if (!seen.other) into.push('plural block for {' + block.name + '} has no "other" variant');
    i = block.end;
  }
}

/**
 * Lint a message template: malformed plural blocks, unknown or repeated variants, a missing
 * `other`. Returns human-readable problems (empty when the template is fine). For tests and tools.
 */
export function messageProblems(template: string): string[] {
  const problems: string[] = [];
  if (typeof template !== 'string') return ['not a string'];
  collectProblems(template, problems, 0);
  return problems;
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
  const merged = mergeTables(Array.isArray(tables) ? tables : []);
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
      if (typeof key !== 'string') return show(key, current); // a caller's bug: still answer with text
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

    num: (n: number): string => directed(formatNumber(n), current),
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
