// Tiny i18n: every module registers its own messages (addMessages) and reads them with t().
// Arabic is the first language; English is the second. A missing key falls back to Arabic, then to the key.
import { useSyncExternalStore } from 'react'

export type Lang = 'ar' | 'en'
export type Dict = Record<string, string>

const dict: Record<Lang, Dict> = { ar: {}, en: {} }
let current: Lang = 'ar'
const listeners = new Set<() => void>()

export function addMessages(m: { ar: Dict; en?: Dict }): void {
  Object.assign(dict.ar, m.ar)
  if (m.en) Object.assign(dict.en, m.en)
}

export function setLang(l: Lang): void {
  if (l === current) return
  current = l
  applyLangToDocument()
  listeners.forEach(f => f())
}
export function applyLangToDocument(): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = current
  document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr'
}
export const getLang = (): Lang => current
export const isRtl = (): boolean => current === 'ar'

/** t('sales.total') or t('sales.items', { n: 3 }) where the message holds {n}. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dict[current][key] ?? dict.ar[key] ?? dict.en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
export function useLang(): Lang { return useSyncExternalStore(subscribe, () => current, () => current) }
/** Re-renders the component when the language changes. */
export function useT(): typeof t { useLang(); return t }

/** The locale used for dates and numbers: Arabic words with western digits. */
export const locale = (): string => (current === 'ar' ? 'ar-u-nu-latn' : 'en-GB')
