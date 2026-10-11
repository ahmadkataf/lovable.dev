// Counted strings with real plural forms (Arabic has six: zero, one, two, few, many, other).
// Keys are written as '<key>_<rule>' in the module dictionary; missing forms fall back to '<key>_other'.
type T = (k: string, p?: Record<string, string | number>) => string

export function pluralRule(n: number, lang: 'ar' | 'en'): Intl.LDMLPluralRule {
  return new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en').select(n)
}

export function tn(t: T, lang: 'ar' | 'en', key: string, n: number, params: Record<string, string | number> = {}): string {
  const rule = pluralRule(n, lang)
  const p = { n, ...params }
  const s = t(`${key}_${rule}`, p)
  return s.endsWith(`_${rule}`) ? t(`${key}_other`, p) : s
}
