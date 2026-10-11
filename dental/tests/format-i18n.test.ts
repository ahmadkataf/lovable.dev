// The shared plural helper (src/i18n): CLDR forms, ICU plural blocks inside strings, and the '<key>_<form>' keys.
import { describe, expect, it } from 'vitest'
import { pluralForm, resolvePlurals, tn, translate } from '../src/i18n'

describe('i18n: plural forms', () => {
  it('Arabic has six forms, English two', () => {
    const ar = (n: number) => pluralForm(n, 'ar')
    expect([0, 1, 2, 3, 10, 11, 99, 100, 101, 102, 103, 111, 1000].map(ar)).toEqual(
      ['zero', 'one', 'two', 'few', 'few', 'many', 'many', 'other', 'other', 'other', 'few', 'many', 'other'])
    expect([0, 1, 2, 5].map(n => pluralForm(n, 'en'))).toEqual(['other', 'one', 'other', 'other'])
  })
  it('resolves ICU plural blocks, exact matches first, # as the number, other params inside the branches', () => {
    const s = '{n, plural, =0 {none} one {one {what}} two {a pair} few {# few} many {# many} other {# other}}'
    const r = (n: number) => resolvePlurals(s, 'ar', { n, what: 'x' })
    expect([0, 1, 2, 7, 15, 200].map(r)).toEqual(['none', 'one {what}', 'a pair', '7 few', '15 many', '200 other'])
    expect(resolvePlurals('{n, plural, one {# day} other {# days}} left', 'en', { n: 1 })).toBe('1 day left')
    // a block whose parameter is missing stays as written
    expect(resolvePlurals('{m, plural, other {#}}', 'en', { n: 1 })).toBe('{m, plural, other {#}}')
  })
  it('translate() fills plural blocks and placeholders', () => {
    expect(translate('ar', 'age.years', { n: 2 })).toBe('سنتان')
    expect(translate('ar', 'age.years', { n: 7 })).toBe('7 سنوات')
    expect(translate('ar', 'age.years', { n: 11 })).toBe('11 سنة')
    expect(translate('ar', 'age.years', { n: 0 })).toBe('أقل من سنة')
    expect(translate('en', 'age.years', { n: 1 })).toBe('1 year')
    expect(translate('en', 'trial.banner', { days: 1 })).toBe('Trial version — 1 day left')
    expect(translate('ar', 'trial.banner', { days: 8 })).toBe('نسخة تجريبية — متبقية 8 أيام')
    expect(translate('ar', 'count.minutes', { n: 5 })).toBe('5 دقائق')
    expect(translate('ar', 'count.days', { n: 2 })).toBe('يومان')
  })
  it('tn() reads <key>_<form>, falls back to <key>_other, then to an ICU key', () => {
    const t = (k: string, p?: Record<string, string | number>) => translate('ar', k, p)
    expect(tn(t, 'ar', 'inventory.itemsCount', 3)).toBe('3 أصناف')
    expect(tn(t, 'ar', 'inventory.itemsCount', 1)).toBe('صنف واحد')
    expect(tn(t, 'ar', 'inventory.itemsCount', 0)).toBe('0 صنف')
    expect(tn(t, 'ar', 'count.days', 12)).toBe('12 يوماً')
  })
  it('a missing key still shows itself (never crashes)', () => {
    expect(translate('ar', 'search.noSuchKey')).toBe('noSuchKey')
    expect(translate('en', 'noSuchBareKey', { n: 1 })).toBe('noSuchBareKey')
  })
})
