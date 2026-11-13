import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createI18n,
  createI18nFromTables,
  detectLang,
  formatClock,
  formatMessage,
  formatNumber,
  mergeTables,
  placeholderNames,
  pluralCategory,
  resolveLang,
} from '../../src/i18n/index.ts';
import type { Lang, StringTable } from '../../src/i18n/types.ts';

const TABLE: StringTable = {
  en: {
    'test.hello': 'Hello',
    'test.level': 'Level {n}',
    'test.pair': '{a} and {b}, then {a} again',
    'test.moves': '{n, plural, one {1 move left} other {{n} moves left}}',
    'test.onlyEn': 'English only',
  },
  ar: {
    'test.hello': 'مرحبًا',
    'test.level': 'المرحلة {n}',
    'test.pair': '{a} و{b} ثم {a} مجددًا',
    'test.moves': '{n, plural, zero {لا حركات} one {حركة واحدة} two {حركتان} few {{n} حركات} many {{n} حركةً} other {{n} حركة}}',
    'test.onlyAr': 'بالعربية فقط',
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('detectLang', () => {
  it("is 'ar' for any Arabic locale", () => {
    for (const locale of ['ar', 'ar-SY', 'ar-SA', 'ar-EG', 'ar_AE', 'AR', 'Ar-ma', ' ar-JO ', 'ar-Arab-SY', 'ar-u-nu-latn']) {
      expect(detectLang(locale), locale).toBe('ar');
    }
  });

  it("is 'en' for everything else", () => {
    for (const locale of ['en', 'en-US', 'en-GB', 'fr-FR', 'de', 'tr-TR', 'fa-IR', 'ur-PK', 'he-IL', 'arc', 'arn-CL', 'zh-Hans-CN', '', 'x']) {
      expect(detectLang(locale), locale).toBe('en');
    }
  });

  it('never throws on odd input', () => {
    for (const odd of [undefined, null, 5, {}, []]) expect(detectLang(odd as unknown as string)).toBe('en');
  });
});

describe('resolveLang', () => {
  it('prefers the saved choice', () => {
    expect(resolveLang('en', 'ar-SY')).toBe('en');
    expect(resolveLang('ar', 'en-US')).toBe('ar');
  });

  it('follows the device when nothing is saved', () => {
    expect(resolveLang(null, 'ar-SY')).toBe('ar');
    expect(resolveLang(null, 'en-US')).toBe('en');
    expect(resolveLang(undefined, 'ar')).toBe('ar');
    expect(resolveLang('fr' as unknown as Lang, 'ar')).toBe('ar');
  });
});

describe('formatNumber', () => {
  it('groups thousands with commas', () => {
    const cases: [number, string][] = [
      [0, '0'],
      [7, '7'],
      [42, '42'],
      [999, '999'],
      [1000, '1,000'],
      [12345, '12,345'],
      [100000, '100,000'],
      [1234567, '1,234,567'],
      [999999999, '999,999,999'],
      [1000000000000, '1,000,000,000,000'],
    ];
    for (const [n, text] of cases) expect(formatNumber(n)).toBe(text);
  });

  it('handles negatives and fractions', () => {
    expect(formatNumber(-5)).toBe('-5');
    expect(formatNumber(-1234)).toBe('-1,234');
    expect(formatNumber(1234.4)).toBe('1,234');
    expect(formatNumber(1234.5)).toBe('1,235');
    expect(formatNumber(999.6)).toBe('1,000');
    expect(formatNumber(-0.2)).toBe('0');
    expect(formatNumber(-0)).toBe('0');
  });

  it('never shows nonsense', () => {
    expect(formatNumber(NaN)).toBe('0');
    // An unbounded value is shown as such — never as "0", which would make an unbounded price look free.
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(-Infinity)).toBe('-∞');
    expect(formatNumber('12' as unknown as number)).toBe('0');
    expect(formatNumber(1e21)).toBe('1e+21');
  });

  it('uses Western digits only', () => {
    for (const n of [0, 5, 1234567890]) expect(formatNumber(n)).toMatch(/^[0-9,]+$/);
  });
});

describe('formatClock', () => {
  it('formats mm:ss', () => {
    const cases: [number, string][] = [
      [0, '00:00'],
      [1000, '00:01'],
      [9000, '00:09'],
      [59_000, '00:59'],
      [60_000, '01:00'],
      [61_000, '01:01'],
      [10 * 60_000, '10:00'],
      [20 * 60_000, '20:00'],
      [59 * 60_000 + 59_000, '59:59'],
    ];
    for (const [ms, text] of cases) expect(formatClock(ms), String(ms)).toBe(text);
  });

  it('rounds up to the next second, like a countdown should', () => {
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(999)).toBe('00:01');
    expect(formatClock(1001)).toBe('00:02');
    expect(formatClock(20 * 60_000 - 1)).toBe('20:00');
    expect(formatClock(19 * 60_000 + 59_000)).toBe('19:59');
    expect(formatClock(59_001)).toBe('01:00');
  });

  it('switches to h:mm:ss from one hour', () => {
    expect(formatClock(3_600_000)).toBe('1:00:00');
    expect(formatClock(3_600_000 + 5 * 60_000 + 9_000)).toBe('1:05:09');
    expect(formatClock(24 * 3_600_000 - 1000)).toBe('23:59:59');
    expect(formatClock(100 * 3_600_000)).toBe('100:00:00');
  });

  it('shows 00:00 for anything that is not a positive time', () => {
    for (const bad of [-1, -60_000, NaN, Infinity, undefined as unknown as number, '5' as unknown as number]) {
      expect(formatClock(bad)).toBe('00:00');
    }
  });
});

describe('pluralCategory', () => {
  it('English: one / other', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    for (const n of [0, 2, 3, 11, 21, 100, 101, 1.5]) expect(pluralCategory('en', n)).toBe('other');
    // Counts are never negative; if one is, the variant that prints the number is used ("-1 moves"),
    // not the one that spells out "1 move".
    expect(pluralCategory('en', -1)).toBe('other');
    expect(pluralCategory('ar', -1)).toBe('other');
    expect(pluralCategory('ar', -2)).toBe('other');
  });

  it('Arabic: zero / one / two / few / many / other', () => {
    const cases: [number, string][] = [
      [0, 'zero'],
      [1, 'one'],
      [2, 'two'],
      [3, 'few'],
      [5, 'few'],
      [10, 'few'],
      [11, 'many'],
      [20, 'many'],
      [99, 'many'],
      [100, 'other'],
      [101, 'other'],
      [102, 'other'],
      [103, 'few'],
      [110, 'few'],
      [111, 'many'],
      [199, 'many'],
      [200, 'other'],
      [1000, 'other'],
      [1003, 'few'],
      [5000, 'other'],
      [1.5, 'other'],
    ];
    for (const [n, category] of cases) expect(pluralCategory('ar', n), String(n)).toBe(category);
  });

  it("is 'other' for non-numbers", () => {
    expect(pluralCategory('ar', NaN)).toBe('other');
    expect(pluralCategory('en', Infinity)).toBe('other');
  });
});

describe('formatMessage', () => {
  it('returns plain text untouched', () => {
    expect(formatMessage('Hello', undefined, 'en')).toBe('Hello');
    expect(formatMessage('', { n: 1 }, 'en')).toBe('');
  });

  it('fills placeholders, also repeated ones', () => {
    expect(formatMessage('Level {n}', { n: 12 }, 'en')).toBe('Level 12');
    expect(formatMessage('{a} and {b}, then {a} again', { a: 'X', b: 'Y' }, 'en')).toBe('X and Y, then X again');
    expect(formatMessage('{a}{b}{a}', { a: 1, b: 2 }, 'en')).toBe('121');
  });

  it('writes whole numbers with thousands separators and strings verbatim', () => {
    expect(formatMessage('Reach {n} points', { n: 12000 }, 'en')).toBe('Reach 12,000 points');
    expect(formatMessage('Reach {n} points', { n: '12000' }, 'en')).toBe('Reach 12000 points');
    expect(formatMessage('x{n}', { n: 2.5 }, 'en')).toBe('x2.5');
    expect(formatMessage('{n}', { n: 0 }, 'en')).toBe('0');
    expect(formatMessage('[{s}]', { s: '' }, 'en')).toBe('[]');
  });

  it('leaves unknown placeholders in place', () => {
    expect(formatMessage('Hi {name}', {}, 'en')).toBe('Hi {name}');
    expect(formatMessage('Hi {name}', undefined, 'en')).toBe('Hi {name}');
    expect(formatMessage('{a} {b}', { a: 1 }, 'en')).toBe('1 {b}');
  });

  it('does not look up inherited properties', () => {
    expect(formatMessage('{constructor} {toString}', {}, 'en')).toBe('{constructor} {toString}');
  });

  it('does not re-interpret inserted values', () => {
    expect(formatMessage('{a}', { a: '{b}', b: 'no' }, 'en')).toBe('{b}');
    expect(formatMessage('{a}', { a: '{n, plural, other {x}}', n: 1 }, 'en')).toBe('{n, plural, other {x}}');
  });

  it('keeps stray braces as text', () => {
    expect(formatMessage('a { b } c', { b: 1 }, 'en')).toBe('a { b } c');
    expect(formatMessage('{', {}, 'en')).toBe('{');
    expect(formatMessage('}{', {}, 'en')).toBe('}{');
    expect(formatMessage('{}', {}, 'en')).toBe('{}');
    expect(formatMessage('{a b}', { a: 1 }, 'en')).toBe('{a b}');
  });

  it('English plurals', () => {
    const t = '{n, plural, one {1 move left} other {{n} moves left}}';
    expect(formatMessage(t, { n: 1 }, 'en')).toBe('1 move left');
    expect(formatMessage(t, { n: 0 }, 'en')).toBe('0 moves left');
    expect(formatMessage(t, { n: 2 }, 'en')).toBe('2 moves left');
    expect(formatMessage(t, { n: 1500 }, 'en')).toBe('1,500 moves left');
  });

  it('Arabic plurals', () => {
    const t = '{n, plural, zero {لا حركات} one {حركة واحدة} two {حركتان} few {{n} حركات} many {{n} حركةً} other {{n} حركة}}';
    expect(formatMessage(t, { n: 0 }, 'ar')).toBe('لا حركات');
    expect(formatMessage(t, { n: 1 }, 'ar')).toBe('حركة واحدة');
    expect(formatMessage(t, { n: 2 }, 'ar')).toBe('حركتان');
    expect(formatMessage(t, { n: 3 }, 'ar')).toBe('3 حركات');
    expect(formatMessage(t, { n: 10 }, 'ar')).toBe('10 حركات');
    expect(formatMessage(t, { n: 11 }, 'ar')).toBe('11 حركةً');
    expect(formatMessage(t, { n: 100 }, 'ar')).toBe('100 حركة');
    expect(formatMessage(t, { n: 103 }, 'ar')).toBe('103 حركات');
  });

  it('a missing category falls back to "other"', () => {
    const t = '{n, plural, one {واحد} other {{n} أشياء}}';
    for (const n of [0, 2, 5, 50, 500]) expect(formatMessage(t, { n }, 'ar')).toBe(n + ' أشياء');
    expect(formatMessage(t, { n: 1 }, 'ar')).toBe('واحد');
  });

  it('exact matches win over categories', () => {
    const t = '{n, plural, =0 {none} =1 {just one} =42 {the answer} one {ONE} other {{n} things}}';
    expect(formatMessage(t, { n: 0 }, 'en')).toBe('none');
    expect(formatMessage(t, { n: 1 }, 'en')).toBe('just one');
    expect(formatMessage(t, { n: 42 }, 'en')).toBe('the answer');
    expect(formatMessage(t, { n: 7 }, 'en')).toBe('7 things');
  });

  it('plurals work in the middle of a sentence and with other placeholders', () => {
    const t = '{who} has {n, plural, one {a gem} other {{n} gems}} and {c} coins';
    expect(formatMessage(t, { who: 'Lina', n: 1, c: 2500 }, 'en')).toBe('Lina has a gem and 2,500 coins');
    expect(formatMessage(t, { who: 'Lina', n: 4, c: 0 }, 'en')).toBe('Lina has 4 gems and 0 coins');
  });

  it('two plural blocks in one message', () => {
    const t = '{a, plural, one {1 star} other {{a} stars}}, {b, plural, one {1 life} other {{b} lives}}';
    expect(formatMessage(t, { a: 1, b: 3 }, 'en')).toBe('1 star, 3 lives');
    expect(formatMessage(t, { a: 2, b: 1 }, 'en')).toBe('2 stars, 1 life');
  });

  it('accepts numbers passed as text for the plural choice', () => {
    const t = '{n, plural, one {1 move} other {{n} moves}}';
    expect(formatMessage(t, { n: '1' }, 'en')).toBe('1 move');
    expect(formatMessage(t, { n: '1,200' }, 'en')).toBe('1,200 moves');
    expect(formatMessage(t, { n: 'many' }, 'en')).toBe('many moves');
  });

  it('without the variable the "other" variant is used and its placeholder stays', () => {
    expect(formatMessage('{n, plural, one {1 move} other {{n} moves}}', {}, 'en')).toBe('{n} moves');
    expect(formatMessage('{n, plural, one {1 move} other {{n} moves}}', undefined, 'en')).toBe('{n} moves');
  });

  it('tolerates whitespace and line breaks inside a plural block', () => {
    const t = '{ n ,plural ,\n  one {1 day}\n  other {{n} days}\n}';
    expect(formatMessage(t, { n: 1 }, 'en')).toBe('1 day');
    expect(formatMessage(t, { n: 3 }, 'en')).toBe('3 days');
  });

  it('malformed plural blocks are left as text instead of throwing', () => {
    for (const bad of ['{n, plural, one {x}', '{n, plural, }', '{n, plural, one x}', '{n, plural, one {a} other {b}', '{n, plural}']) {
      expect(() => formatMessage(bad, { n: 1 }, 'en')).not.toThrow();
      expect(formatMessage(bad, { n: 1 }, 'en')).toContain('plural');
    }
  });

  it('a block without "other" falls back to its last variant', () => {
    expect(formatMessage('{n, plural, one {single} two {double}}', { n: 9 }, 'en')).toBe('double');
  });
});

describe('placeholderNames', () => {
  it('lists simple placeholders and plural variables, once each, sorted', () => {
    expect(placeholderNames('Hello')).toEqual([]);
    expect(placeholderNames('{b} {a} {b}')).toEqual(['a', 'b']);
    expect(placeholderNames('{n, plural, one {Bring down the lamp} other {Bring down {n} lamps}}')).toEqual(['n']);
    expect(placeholderNames('{n, plural, one {Collect 1 {gem} gem} other {Collect {n} {gem} gems}}')).toEqual(['gem', 'n']);
    expect(placeholderNames('{count, plural, one {x} other {y}} of {total}')).toEqual(['count', 'total']);
    expect(placeholderNames('{n, plural, one {Move} other {Moves}}')).toEqual(['n']);
    expect(placeholderNames('{constructor} { loose } {')).toEqual(['constructor']);
  });
});

describe('mergeTables', () => {
  it('merges namespaces; later tables win on a clash', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const merged = mergeTables([
      { en: { 'a.x': 'one', 'a.y': 'why' }, ar: { 'a.x': 'واحد', 'a.y': 'لماذا' } },
      { en: { 'b.z': 'zed', 'a.x': 'uno' }, ar: { 'b.z': 'زد', 'a.x': 'أونو' } },
    ]);
    expect({ ...merged.en }).toEqual({ 'a.x': 'uno', 'a.y': 'why', 'b.z': 'zed' });
    expect({ ...merged.ar }).toEqual({ 'a.x': 'أونو', 'a.y': 'لماذا', 'b.z': 'زد' });
  });

  it('ignores things that are not tables or not strings', () => {
    const merged = mergeTables([
      null as unknown as StringTable,
      { en: { ok: 'fine', bad: 5 as unknown as string }, ar: { ok: 'تمام' } },
      { en: {} } as unknown as StringTable,
    ]);
    expect({ ...merged.en }).toEqual({ ok: 'fine' });
    expect({ ...merged.ar }).toEqual({ ok: 'تمام' });
  });

  it('does not modify its input', () => {
    const table: StringTable = { en: { k: 'v' }, ar: { k: 'ق' } };
    const copy = JSON.parse(JSON.stringify(table));
    mergeTables([table, { en: { k: 'w' }, ar: { k: 'و' } }]);
    expect(table).toEqual(copy);
  });
});

describe('createI18nFromTables', () => {
  it('translates in the initial language', () => {
    const en = createI18nFromTables([TABLE], 'en');
    expect(en.lang()).toBe('en');
    expect(en.isRtl()).toBe(false);
    expect(en.t('test.hello')).toBe('Hello');
    const ar = createI18nFromTables([TABLE], 'ar');
    expect(ar.lang()).toBe('ar');
    expect(ar.isRtl()).toBe(true);
    expect(ar.t('test.hello')).toBe('مرحبًا');
  });

  it('interpolates', () => {
    const i18n = createI18nFromTables([TABLE], 'en');
    expect(i18n.t('test.level', { n: 7 })).toBe('Level 7');
    expect(i18n.t('test.pair', { a: 'red', b: 'blue' })).toBe('red and blue, then red again');
    expect(i18n.t('test.moves', { n: 1 })).toBe('1 move left');
    expect(i18n.t('test.moves', { n: 12 })).toBe('12 moves left');
    i18n.setLang('ar');
    expect(i18n.t('test.level', { n: 7 })).toBe('المرحلة 7');
    expect(i18n.t('test.moves', { n: 2 })).toBe('حركتان');
    expect(i18n.t('test.moves', { n: 12 })).toBe('12 حركةً');
  });

  it('always uses Western digits, in Arabic too', () => {
    const i18n = createI18nFromTables([TABLE], 'ar');
    expect(i18n.t('test.level', { n: 1234 })).toBe('المرحلة 1,234');
    expect(i18n.num(9876543)).toBe('9,876,543');
    expect(i18n.clock(125_000)).toBe('02:05');
    expect(i18n.t('test.level', { n: 5 }) + i18n.num(10) + i18n.clock(1000)).not.toMatch(/[٠-٩۰-۹]/);
  });

  it('an unknown key returns the key itself and warns once (dev)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const i18n = createI18nFromTables([TABLE], 'en');
    expect(i18n.t('nope.missing')).toBe('nope.missing');
    expect(i18n.t('nope.missing', { n: 3 })).toBe('nope.missing');
    expect(i18n.t('')).toBe('');
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('nope.missing')).length).toBe(1);
  });

  it('a key missing in one language falls back to the other language', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const i18n = createI18nFromTables([TABLE], 'ar');
    expect(i18n.t('test.onlyEn')).toBe('English only');
    i18n.setLang('en');
    expect(i18n.t('test.onlyAr')).toBe('بالعربية فقط');
  });

  it('object-prototype names are not keys', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const i18n = createI18nFromTables([TABLE], 'en');
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
      expect(i18n.t(key)).toBe(key);
    }
  });

  it('setLang switches and notifies with the new language', () => {
    const i18n = createI18nFromTables([TABLE], 'en');
    const seen: Lang[] = [];
    i18n.onChange((lang) => seen.push(lang));
    i18n.setLang('ar');
    expect(i18n.lang()).toBe('ar');
    expect(i18n.isRtl()).toBe(true);
    expect(i18n.t('test.hello')).toBe('مرحبًا');
    i18n.setLang('en');
    expect(i18n.isRtl()).toBe(false);
    expect(seen).toEqual(['ar', 'en']);
  });

  it('listeners already see the new language when they are called', () => {
    const i18n = createI18nFromTables([TABLE], 'en');
    const texts: string[] = [];
    i18n.onChange(() => texts.push(i18n.t('test.hello') + '|' + i18n.lang() + '|' + i18n.isRtl()));
    i18n.setLang('ar');
    expect(texts).toEqual(['مرحبًا|ar|true']);
  });

  it('setting the current language again does not notify', () => {
    const i18n = createI18nFromTables([TABLE], 'ar');
    let calls = 0;
    i18n.onChange(() => calls++);
    i18n.setLang('ar');
    expect(calls).toBe(0);
  });

  it('unsupported languages are ignored', () => {
    const i18n = createI18nFromTables([TABLE], 'en');
    let calls = 0;
    i18n.onChange(() => calls++);
    for (const bad of ['fr', '', null, undefined, 'AR']) i18n.setLang(bad as unknown as Lang);
    expect(i18n.lang()).toBe('en');
    expect(calls).toBe(0);
    expect(createI18nFromTables([TABLE], 'de' as unknown as Lang).lang()).toBe('en');
  });

  it('onChange returns an unsubscribe function', () => {
    const i18n = createI18nFromTables([TABLE], 'en');
    let a = 0;
    let b = 0;
    const off = i18n.onChange(() => a++);
    i18n.onChange(() => b++);
    i18n.setLang('ar');
    off();
    off();
    i18n.setLang('en');
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it('a throwing listener does not stop the others', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const i18n = createI18nFromTables([TABLE], 'en');
    let reached = 0;
    i18n.onChange(() => {
      throw new Error('boom');
    });
    i18n.onChange(() => reached++);
    expect(() => i18n.setLang('ar')).not.toThrow();
    expect(reached).toBe(1);
    expect(i18n.lang()).toBe('ar');
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('works with no tables at all', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const i18n = createI18nFromTables([], 'ar');
    expect(i18n.t('common.ok')).toBe('common.ok');
    expect(i18n.num(1000)).toBe('1,000');
  });

  it('t, num and clock can be used detached from the object', () => {
    const { t, num, clock } = createI18nFromTables([TABLE], 'en');
    expect(t('test.level', { n: 2 })).toBe('Level 2');
    expect(num(1234)).toBe('1,234');
    expect(clock(61_000)).toBe('01:01');
  });
});

describe('<html lang dir>', () => {
  function fakeDocument(): { attrs: Record<string, string>; doc: unknown } {
    const attrs: Record<string, string> = {};
    const doc = {
      documentElement: {
        setAttribute(name: string, value: string): void {
          attrs[name] = value;
        },
      },
    };
    return { attrs, doc };
  }

  it('is applied at creation and on every switch', () => {
    const { attrs, doc } = fakeDocument();
    vi.stubGlobal('document', doc);
    const i18n = createI18nFromTables([TABLE], 'ar');
    expect(attrs).toEqual({ lang: 'ar', dir: 'rtl' });
    i18n.setLang('en');
    expect(attrs).toEqual({ lang: 'en', dir: 'ltr' });
    i18n.setLang('ar');
    expect(attrs).toEqual({ lang: 'ar', dir: 'rtl' });
  });

  it('is re-applied even when the language does not change', () => {
    const { attrs, doc } = fakeDocument();
    vi.stubGlobal('document', doc);
    const i18n = createI18nFromTables([TABLE], 'en');
    attrs.dir = 'rtl'; // something else changed it
    i18n.setLang('en');
    expect(attrs).toEqual({ lang: 'en', dir: 'ltr' });
  });

  it('a missing or broken document is not a problem', () => {
    expect(typeof document).toBe('undefined'); // the tests run without a DOM
    expect(() => createI18nFromTables([TABLE], 'ar').setLang('en')).not.toThrow();
    vi.stubGlobal('document', {});
    expect(() => createI18nFromTables([TABLE], 'ar').setLang('en')).not.toThrow();
    vi.stubGlobal('document', {
      documentElement: {
        setAttribute(): void {
          throw new Error('read-only');
        },
      },
    });
    expect(() => createI18nFromTables([TABLE], 'ar').setLang('en')).not.toThrow();
  });
});

describe('createI18n (the bundled strings)', () => {
  it('loads the shared vocabulary in both languages', () => {
    const i18n = createI18n('en');
    expect(i18n.t('common.ok')).toBe('OK');
    expect(i18n.t('common.level', { n: 3 })).toBe('Level 3');
    expect(i18n.t('chapter.oasis')).toBe('Oasis');
    i18n.setLang('ar');
    expect(i18n.t('common.level', { n: 3 })).toBe('المرحلة 3');
    expect(i18n.t('chapter.oasis')).toBe('الواحة');
    expect(i18n.isRtl()).toBe(true);
  });

  it('goal sentences read correctly for every count', () => {
    const i18n = createI18n('en');
    expect(i18n.t('goal.lamp', { n: 1 })).toBe('Bring down the lamp');
    expect(i18n.t('goal.lamp', { n: 4 })).toBe('Bring down 4 lamps');
    expect(i18n.t('goal.score', { n: 12000 })).toBe('Reach 12,000 points');
    expect(i18n.t('goal.color', { n: 25 })).toBe('Collect 25');
    expect(i18n.t('goal.colorNamed', { n: 25, gem: i18n.t('gem.0') })).toBe('Collect 25 Ruby gems');
    expect(i18n.t('goal.sand')).toBe('Clear all the sand');
    i18n.setLang('ar');
    expect(i18n.t('goal.lamp', { n: 1 })).toBe('أنزل الفانوس');
    expect(i18n.t('goal.lamp', { n: 2 })).toBe('أنزل الفانوسين');
    expect(i18n.t('goal.lamp', { n: 4 })).toBe('أنزل 4 فوانيس');
    expect(i18n.t('goal.lamp', { n: 12 })).toBe('أنزل 12 فانوسًا');
    expect(i18n.t('goal.score', { n: 12000 })).toBe('اجمع 12,000 نقطة');
    expect(i18n.t('goal.colorNamed', { n: 25, gem: i18n.t('gem.0') })).toBe('اجمع 25 من الياقوت الأحمر');
  });

  it('has a name and a description for every booster, a name for every gem, goal and chapter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const lang of ['en', 'ar'] as const) {
      const i18n = createI18n(lang);
      const keys = [
        ...['hammer', 'freeSwap', 'shuffle', 'extraMoves', 'prism', 'beamNova'].flatMap((id) => [`booster.${id}.name`, `booster.${id}.desc`]),
        ...[0, 1, 2, 3, 4, 5].map((c) => `gem.${c}`),
        ...['score', 'color', 'sand', 'lamp', 'stone', 'vine', 'chain'].flatMap((k) => [`goal.${k}`, `goal.name.${k}`]),
        ...['oasis', 'dunes', 'bazaar', 'palace', 'caverns', 'stars'].map((c) => `chapter.${c}`),
        ...['ok', 'cancel', 'yes', 'no', 'close', 'back', 'play', 'continue', 'retry', 'next', 'level', 'moves', 'score', 'stars'].map((k) => `common.${k}`),
        ...['coins', 'lives', 'full', 'free', 'buy', 'use', 'owned', 'notEnoughCoins'].map((k) => `common.${k}`),
      ];
      for (const key of keys) {
        const text = i18n.t(key, { n: 3, gem: 'x' });
        expect(text, key).not.toBe(key);
        expect(text.trim().length, key).toBeGreaterThan(0);
      }
    }
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('missing'))).toEqual([]);
  });

  it('time words', () => {
    const i18n = createI18n('en');
    expect(i18n.t('common.time.minutes', { n: 1 })).toBe('1 minute');
    expect(i18n.t('common.time.minutes', { n: 20 })).toBe('20 minutes');
    expect(i18n.t('common.time.in', { time: i18n.t('common.time.hours', { n: 5 }) })).toBe('in 5 hours');
    i18n.setLang('ar');
    expect(i18n.t('common.time.minutes', { n: 1 })).toBe('دقيقة واحدة');
    expect(i18n.t('common.time.minutes', { n: 2 })).toBe('دقيقتين');
    expect(i18n.t('common.time.minutes', { n: 5 })).toBe('5 دقائق');
    expect(i18n.t('common.time.minutes', { n: 20 })).toBe('20 دقيقة');
    expect(i18n.t('common.time.days', { n: 11 })).toBe('11 يومًا');
    expect(i18n.t('common.time.days', { n: 100 })).toBe('100 يوم');
    expect(i18n.t('common.time.in', { time: i18n.t('common.time.hours', { n: 5 }) })).toBe('بعد 5 ساعات');
  });
});
