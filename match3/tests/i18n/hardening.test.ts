/**
 * Hardening: i18n under hostile input. num() / clock() for zero, negatives and huge values; plural
 * rules against the platform's own CLDR data; templates that are malformed, enormous or re-entrant;
 * keys and variables that are not what the types promise. Nothing may throw, and what comes out
 * must always be text.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createI18n,
  createI18nFromTables,
  formatClock,
  formatMessage,
  formatNumber,
  mergeTables,
  messageProblems,
  placeholderNames,
  pluralCategory,
} from '../../src/i18n/index.ts';
import type { Lang, StringTable } from '../../src/i18n/types.ts';

const LRM = '\u200E';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TABLE: StringTable = {
  en: {
    'x.level': 'Level {n}',
    'x.delta': 'Change: {n}',
    'x.moves': '{n, plural, one {1 move} other {{n} moves}}',
    'x.pair': '{a} / {b}',
  },
  ar: {
    'x.level': 'المرحلة {n}',
    'x.delta': 'التغيير: {n}',
    'x.moves': '{n, plural, one {حركة واحدة} two {حركتان} few {{n} حركات} many {{n} حركة} other {{n} حركة}}',
    'x.pair': '{a} / {b}',
  },
};

// ───────────────────────────── num() ─────────────────────────────

describe('hardening: num()', () => {
  it('zero in all its forms is "0"', () => {
    for (const lang of ['en', 'ar'] as const) {
      const { num } = createI18nFromTables([], lang);
      for (const zero of [0, -0, 0.4, -0.4, 0.49999, -0.5, 1e-320, -1e-320]) expect(num(zero), String(zero)).toBe('0');
    }
  });

  it('round-trips every kind of whole number, with Western digits and correct grouping', () => {
    const random = rng(11);
    const samples = [1, 9, 10, 99, 100, 999, 1000, 9999, 10000, 99999, 100000, 999999, 1000000, 999_999_999, 2 ** 31, 2 ** 53 - 1, 1e15, 1e20, 123456789012345680000];
    for (let i = 0; i < 3000; i++) samples.push(Math.floor(random() * 10 ** (1 + Math.floor(random() * 15))));
    for (const n of samples) {
      for (const value of [n, -n]) {
        const text = formatNumber(value);
        expect(text, String(value)).toMatch(/^-?(?:\d{1,3})(?:,\d{3})*$/);
        expect(Number(text.replace(/,/g, '')), String(value)).toBe(value + 0); // "+ 0": −0 is written "0"
      }
    }
  });

  it('huge, tiny and impossible values never produce nonsense', () => {
    expect(formatNumber(Number.MAX_SAFE_INTEGER)).toBe('9,007,199,254,740,991');
    expect(formatNumber(1e21)).toBe('1e+21'); // beyond what can be grouped: plain, still a number
    expect(formatNumber(-1e21)).toBe('-1e+21');
    expect(formatNumber(Number.MAX_VALUE)).toMatch(/^1\.79\d*e\+308$/);
    expect(formatNumber(Number.MIN_VALUE)).toBe('0');
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(-Infinity)).toBe('-∞');
    for (const bad of [undefined, null, '12', '', true, [], {}, 10n, Symbol('n'), () => 1, new Date(0)]) {
      expect(formatNumber(bad as unknown as number)).toBe('0');
    }
    for (const n of [0.5, 1.5, 2.5, -1.5, 999.5, 999999.5]) expect(formatNumber(n)).toBe(formatNumber(Math.round(n)));
  });

  it('negative numbers stay readable in Arabic: the minus is kept on the left of its digits', () => {
    const i18n = createI18nFromTables([TABLE], 'ar');
    expect(i18n.num(-5)).toBe(LRM + '-5');
    expect(i18n.num(-1234567)).toBe(LRM + '-1,234,567');
    expect(i18n.num(-Infinity)).toBe(LRM + '-∞' + LRM); // no digit to hold on to: marked on both sides
    // Nothing is added where nothing is needed.
    for (const n of [0, -0, -0.2, 5, 1234567, Infinity, NaN]) expect(i18n.num(n)).not.toContain(LRM);
    expect(i18n.t('x.delta', { n: -120 })).toBe('التغيير: ' + LRM + '-120');
    expect(i18n.t('x.delta', { n: -2.5 })).toBe('التغيير: ' + LRM + '-2.5');
    expect(i18n.t('x.delta', { n: 120 })).toBe('التغيير: 120');
    expect(i18n.t('x.delta', { n: '-120' })).toBe('التغيير: -120'); // text is inserted verbatim
    // English needs no mark, and switching the language switches the behaviour of the same function.
    const num = i18n.num;
    i18n.setLang('en');
    expect(num(-5)).toBe('-5');
    expect(i18n.t('x.delta', { n: -120 })).toBe('Change: -120');
    i18n.setLang('ar');
    expect(num(-5)).toBe(LRM + '-5');
    // The exported pure helper never adds marks.
    expect(formatNumber(-5)).toBe('-5');
  });

  it('never contains Arabic-Indic or other non-Western digits', () => {
    const i18n = createI18nFromTables([TABLE], 'ar');
    const random = rng(4);
    for (let i = 0; i < 500; i++) {
      const n = Math.floor((random() - 0.3) * 1e12);
      expect(i18n.num(n).replace(LRM, '')).toMatch(/^-?[0-9,]+$/);
      expect(i18n.t('x.level', { n }).replace(/[^\d٠-٩۰-۹]/g, '')).toMatch(/^[0-9]*$/);
    }
  });
});

// ───────────────────────────── clock() ─────────────────────────────

describe('hardening: clock()', () => {
  function seconds(text: string): number {
    const parts = text.split(':').map(Number);
    return parts.length === 3 ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]! : parts[0]! * 60 + parts[1]!;
  }

  it('zero, negatives and non-times are "00:00"', () => {
    for (const bad of [0, -0, -1, -999, -1e15, -Infinity, NaN, Infinity, undefined, null, '5000', true, {}, [], 10n]) {
      expect(formatClock(bad as unknown as number), String(bad)).toBe('00:00');
    }
  });

  it('boundaries: the last second, the minute and the hour', () => {
    const cases: [number, string][] = [
      [0.001, '00:01'],
      [1, '00:01'],
      [999, '00:01'],
      [1000, '00:01'],
      [1001, '00:02'],
      [59_000, '00:59'],
      [59_001, '01:00'],
      [60_000, '01:00'],
      [60_001, '01:01'],
      [599_999, '10:00'],
      [20 * 60_000, '20:00'],
      [20 * 60_000 - 1, '20:00'],
      [20 * 60_000 - 1000, '19:59'],
      [3_599_000, '59:59'],
      [3_599_001, '1:00:00'],
      [3_600_000, '1:00:00'],
      [3_661_000, '1:01:01'],
      [86_400_000, '24:00:00'],
      [86_399_001, '24:00:00'],
      [100 * 3_600_000, '100:00:00'],
    ];
    for (const [ms, text] of cases) expect(formatClock(ms), String(ms)).toBe(text);
  });

  it('always shows the time rounded up to whole seconds, in a fixed shape, for any value', () => {
    const random = rng(21);
    for (let i = 0; i < 5000; i++) {
      const ms = random() < 0.2 ? Math.floor(random() * 5000) : random() * 10 ** (1 + Math.floor(random() * 12));
      const text = formatClock(ms);
      expect(text, String(ms)).toMatch(/^(?:\d+:[0-5]\d:[0-5]\d|[0-5]\d:[0-5]\d)$/);
      expect(seconds(text), String(ms)).toBe(Math.ceil(ms / 1000));
    }
  });

  it('a countdown never jumps upwards and ends exactly at zero', () => {
    let previous = Infinity;
    for (let ms = 125_250; ms >= -500; ms -= 250) {
      const now = seconds(formatClock(ms));
      expect(now).toBeLessThanOrEqual(previous);
      expect(now === 0).toBe(ms <= 0);
      previous = now;
    }
  });

  it('enormous values stay well-formed', () => {
    expect(formatClock(8.64e15)).toBe('2400000000:00:00');
    expect(formatClock(Number.MAX_SAFE_INTEGER)).toMatch(/^\d+:[0-5]\d:[0-5]\d$/);
    expect(formatClock(1e300)).toMatch(/:/);
    expect(formatClock(1e300)).not.toMatch(/NaN|undefined/);
    expect(createI18nFromTables([], 'ar').clock(3_661_000)).toBe('1:01:01');
  });
});

// ───────────────────────────── plurals ─────────────────────────────

describe('hardening: plural rules', () => {
  it('match the platform’s CLDR data for every count from 0 to 20,000 and beyond', () => {
    for (const lang of ['en', 'ar'] as const) {
      const rules = new Intl.PluralRules(lang);
      const mismatches: string[] = [];
      const check = (n: number): void => {
        if (pluralCategory(lang, n) !== rules.select(n) && mismatches.length < 5) mismatches.push(`${lang} ${n}: ${pluralCategory(lang, n)} ≠ ${rules.select(n)}`);
      };
      for (let n = 0; n <= 20_000; n++) check(n);
      const random = rng(lang.length);
      for (let i = 0; i < 5000; i++) check(Math.floor(random() * 1e12));
      for (const n of [0.5, 1.5, 2.5, 3.5, 10.5, 11.5, 100.5, 1e15, 1e21]) check(n);
      expect(mismatches).toEqual([]);
    }
  });

  it('negative and impossible counts print their number instead of a spelled-out variant', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const n of [-1, -2, -3, -11, -100, -0.5, NaN, Infinity, -Infinity]) expect(pluralCategory(lang, n), `${lang} ${n}`).toBe('other');
      for (const bad of [undefined, null, '1', {}, [], true]) expect(pluralCategory(lang, bad as unknown as number)).toBe('other');
    }
    expect(pluralCategory('en', -0)).toBe('other');
    expect(pluralCategory('ar', -0)).toBe('zero');
    const i18n = createI18nFromTables([TABLE], 'en');
    expect(i18n.t('x.moves', { n: -1 })).toBe('-1 moves');
    expect(i18n.t('x.moves', { n: 1 })).toBe('1 move');
    i18n.setLang('ar');
    expect(i18n.t('x.moves', { n: -1 })).toBe(LRM + '-1 حركة');
    expect(i18n.t('x.moves', { n: -2 })).toBe(LRM + '-2 حركة');
    expect(i18n.t('x.moves', { n: 2 })).toBe('حركتان');
    expect(i18n.t('x.moves', { n: 0 })).toBe('0 حركة');
    expect(i18n.t('x.moves', { n: 1_000_003 })).toBe('1,000,003 حركات');
    expect(i18n.t('x.moves', { n: 1e21 })).toBe('1e+21 حركة');
  });

  it('every count gives a clean sentence in the bundled strings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const lang of ['en', 'ar'] as const) {
      const i18n = createI18n(lang);
      for (const key of ['common.time.days', 'common.time.hours', 'common.time.minutes', 'common.time.seconds', 'goal.score', 'goal.lamp', 'goal.colorNamed']) {
        for (let n = 0; n <= 1200; n++) {
          const text = i18n.t(key, { n, gem: 'X' });
          if (/[{}]|undefined|NaN/.test(text) || text.trim() === '') expect(`${lang} ${key} ${n}: ${text}`).toBe('clean');
          // The number is either printed or spelled out (1 and 2, and the single lamp).
          if (n > 2 && text.indexOf(formatNumber(n)) < 0) expect(`${lang} ${key} ${n}: ${text}`).toBe('to contain the number');
        }
      }
    }
    warn.mockRestore();
  });
});

// ───────────────────────────── t() and templates ─────────────────────────────

describe('hardening: t()', () => {
  it('answers with text for keys that are not strings or not there', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const i18n = createI18nFromTables([TABLE], 'ar');
    const t = i18n.t as (key: unknown, vars?: unknown) => unknown;
    for (const key of [undefined, null, 0, 5, NaN, true, {}, [], ['x.level'], Symbol('k'), () => 'x', Object.create(null)]) {
      let out: unknown;
      expect(() => {
        out = t(key);
      }).not.toThrow();
      expect(typeof out).toBe('string');
    }
    for (const key of ['', ' ', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'x', 'x.', 'x.level.', 'X.LEVEL', 'a'.repeat(100_000)]) {
      expect(t(key)).toBe(key);
    }
    warn.mockRestore();
  });

  it('survives variables that are not what the types promise', () => {
    const i18n = createI18nFromTables([TABLE], 'en');
    const t = i18n.t as (key: string, vars?: unknown) => string;
    expect(t('x.level', null)).toBe('Level {n}');
    expect(t('x.level', 5)).toBe('Level {n}');
    expect(t('x.level', 'n')).toBe('Level {n}');
    expect(t('x.level', [7])).toBe('Level {n}');
    expect(t('x.level', { n: null })).toBe('Level {n}');
    expect(t('x.level', { n: undefined })).toBe('Level {n}');
    expect(t('x.level', { n: true })).toBe('Level true');
    expect(t('x.level', { n: NaN })).toBe('Level NaN');
    expect(t('x.level', { n: Infinity })).toBe('Level ∞');
    expect(t('x.level', { n: 10n })).toBe('Level 10');
    expect(t('x.level', { n: Symbol('s') })).toBe('Level Symbol(s)');
    expect(t('x.level', { n: Object.create(null) })).toBe('Level ');
    expect(
      t('x.level', {
        n: {
          toString() {
            throw new Error('boom');
          },
        },
      }),
    ).toBe('Level ');
    expect(t('x.level', Object.create({ n: 3 }))).toBe('Level {n}'); // inherited: not a variable
    expect(t('x.moves', { n: {} })).toBe('[object Object] moves');
    expect(t('x.moves', { n: '1' })).toBe('1 move');
    expect(t('x.moves', { n: ' 1,000 ' })).toBe(' 1,000  moves');
    // Inserted text is never interpreted again, whatever it contains.
    expect(t('x.pair', { a: '{b}', b: '{a}' })).toBe('{b} / {a}');
    expect(t('x.pair', { a: '{n, plural, other {x}}', b: '}{' })).toBe('{n, plural, other {x}} / }{');
    expect(t('x.level', { n: '<b>&amp;</b>' })).toBe('Level <b>&amp;</b>'); // text, not markup: the UI must use textContent
  });

  it('a variable whose toString() translates again cannot derail the outer message', () => {
    const i18n = createI18nFromTables([TABLE], 'en');
    const t = i18n.t as (key: string, vars?: unknown) => string;
    const inner = { toString: () => t('x.pair', { a: t('x.moves', { n: 2 }), b: t('x.level', { n: 9 }) }) };
    expect(t('x.pair', { a: inner, b: inner })).toBe('2 moves / Level 9 / 2 moves / Level 9');
    expect(t('x.level', { n: inner })).toBe('Level 2 moves / Level 9');
  });

  it('language switches with hostile values are ignored', () => {
    const i18n = createI18nFromTables([TABLE], 'ar');
    const setLang = i18n.setLang as (lang: unknown) => void;
    for (const bad of [undefined, null, '', 'AR', 'ar-SY', 'fr', 0, {}, ['en'], '__proto__', 'constructor']) setLang(bad);
    expect(i18n.lang()).toBe('ar');
    expect(i18n.isRtl()).toBe(true);
    for (const initial of [undefined, null, 'fr', 5, {}, 'AR']) {
      const made = createI18nFromTables([TABLE], initial as Lang);
      expect(made.lang()).toBe('en');
      expect(made.t('x.level', { n: 1 })).toBe('Level 1');
    }
  });

  it('tables that are not tables are ignored', () => {
    for (const tables of [null, undefined, 5, 'x', {}, [null, 5, 'x', [], { en: null, ar: {} }, { en: { a: 1, 'k.ok': 'fine' }, ar: [] }]]) {
      const i18n = createI18nFromTables(tables as StringTable[], 'en');
      expect(i18n.t('missing.key')).toBe('missing.key');
    }
    const merged = mergeTables([{ en: { ['__proto__']: 'p', constructor: 'c', 'k.a': 'A' }, ar: {} }]);
    expect(Object.getPrototypeOf(merged.en)).toBeNull();
    expect(merged.en.constructor).toBe('c');
    expect(({} as Record<string, unknown>).p).toBeUndefined();
    const i18n = createI18nFromTables([{ en: { constructor: 'c', toString: 't' }, ar: {} }], 'en');
    expect(i18n.t('constructor')).toBe('c');
    expect(i18n.t('valueOf')).toBe('valueOf');
  });
});

describe('hardening: malformed and enormous templates', () => {
  const PIECES = [
    '{', '}', '{{', '}}', '{n}', '{ n }', '{m}', '{n,', '{n, plural,', '{n, plural, ', 'one {', 'other {', '=0 {', '=1{', 'few{', 'bogus {',
    ' ', ',', 'x', 'plural', 'n', 'نص', '\n', '{n, plural, one {a} other {b}}', '{n, plural, other {{n} {m}}}', '{n, select, a {x}}', '{}', '{0}', '{_}',
  ];

  it('20,000 random templates never throw, always terminate and always give text', () => {
    const random = rng(2026);
    const vars = { n: 3, m: 'M' };
    for (let i = 0; i < 20_000; i++) {
      let template = '';
      for (let k = 1 + Math.floor(random() * 12); k > 0; k--) template += PIECES[Math.floor(random() * PIECES.length)];
      for (const lang of ['en', 'ar'] as const) {
        let out: unknown;
        try {
          out = formatMessage(template, vars, lang);
          placeholderNames(template);
          messageProblems(template);
        } catch (err) {
          expect(`${JSON.stringify(template)} threw ${String(err)}`).toBe('no throw');
        }
        if (typeof out !== 'string') expect(JSON.stringify(template)).toBe('a string result');
      }
      // Text without any brace comes back untouched.
      const plain = template.replace(/[{}]/g, '');
      if (formatMessage(plain, vars, 'en') !== plain) expect(JSON.stringify(plain)).toBe('unchanged');
    }
  });

  it('well-formed templates are filled completely, whatever surrounds them', () => {
    const random = rng(7);
    for (let i = 0; i < 2000; i++) {
      const n = Math.floor(random() * 200);
      const before = ['', 'a ', 'نص ', '} ', '{ ', '{x ', 'one {'][Math.floor(random() * 7)]!;
      const after = ['', ' b', ' نص', ' }', ' {', ' other {'][Math.floor(random() * 6)]!;
      const out = formatMessage(before + '{n, plural, one {single} other {{n} many}}' + after, { n }, 'en');
      expect(out).toBe(before + (n === 1 ? 'single' : formatNumber(n) + ' many') + after);
    }
  });

  it('absurd sizes and nesting depths are survived', () => {
    const long = 'x'.repeat(1_000_000);
    expect(formatMessage(long + '{n}' + long, { n: 1 }, 'en').length).toBe(2_000_001);
    expect(formatMessage('{'.repeat(50_000), { n: 1 }, 'en')).toBe('{'.repeat(50_000));
    expect(formatMessage('}'.repeat(50_000), { n: 1 }, 'en')).toBe('}'.repeat(50_000));
    expect(formatMessage('{n}'.repeat(50_000), { n: 7 }, 'en')).toBe('7'.repeat(50_000));
    // Plural blocks nested far deeper than any real string: text comes back, never an exception —
    // and quickly (without the nesting limit this takes half a minute and the test times out).
    let nested = '{n}';
    for (let depth = 0; depth < 20_000; depth++) nested = '{n, plural, other {' + nested + '}}';
    let out: unknown;
    expect(() => {
      out = formatMessage(nested, { n: 5 }, 'en');
      expect(placeholderNames(nested)).toEqual(['n']);
      expect(messageProblems(nested).join()).toContain('nested too deeply');
    }).not.toThrow();
    expect(typeof out).toBe('string');
    // Real nesting (a plural inside a plural inside a plural) works; the limit is far above it.
    let shallow = '{n}';
    for (let depth = 0; depth < 8; depth++) shallow = '{n, plural, other {' + shallow + '}}';
    expect(formatMessage(shallow, { n: 5 }, 'ar')).toBe('5');
    expect(messageProblems(shallow)).toEqual([]);
    expect(formatMessage('{a, plural, one {{b, plural, one {1×1} other {1×{b}}}} other {{b, plural, one {{a}×1} other {{a}×{b}}}}}', { a: 3, b: 1 }, 'en')).toBe('3×1');
    expect(formatMessage(undefined as unknown as string, { n: 1 }, 'en')).toBe('');
    expect(formatMessage(null as unknown as string, undefined, 'ar')).toBe('');
  });
});
