// Counted phrases with real plural forms. Arabic has six (zero, one, two, few = 3–10, many = 11–99, other = 100+),
// English two (one, other). Keys are written '<key>_<form>' in the module dictionary; a missing form falls back
// to '<key>_other'.
type T = (key: string, params?: Record<string, string | number>) => string

export function pluralForm(n: number, lang: string): Intl.LDMLPluralRule {
  try { return new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en').select(n) } catch { return n === 1 ? 'one' : 'other' }
}
/** t('license.daysLeft_few', { n: 3 }) for n = 3 in Arabic, and so on. Extra params are passed through. */
export function tPlural(t: T, lang: string, key: string, n: number, params: Record<string, string | number> = {}): string {
  const form = pluralForm(n, lang)
  const p = { n, ...params }
  const k = `${key}_${form}`
  const s = t(k, p)
  return s === k || s === k.slice(k.indexOf('.') + 1) ? t(`${key}_other`, p) : s
}
