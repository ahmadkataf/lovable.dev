import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '@/db/types'
import type { Dict, ModuleDict } from './types'
import common from './common'
import patients from './modules/patients'
import chart from './modules/chart'
import appointments from './modules/appointments'
import treatments from './modules/treatments'
import prescriptions from './modules/prescriptions'
import lab from './modules/lab'
import billing from './modules/billing'
import inventory from './modules/inventory'
import expenses from './modules/expenses'
import reports from './modules/reports'
import dashboard from './modules/dashboard'
import auth from './modules/auth'
import staff from './modules/staff'
import settings from './modules/settings'
import license from './modules/license'
import search from './modules/search'
import seed from './modules/seed'
import backup from './modules/backup'
import legal from './modules/legal'

export type { Dict, ModuleDict }
const MODULES: Record<string, ModuleDict> = { common, patients, chart, appointments, treatments, prescriptions, lab, billing, inventory, expenses, reports, dashboard, auth, staff, settings, license, search, seed, backup, legal }

/**
 * Adds strings to a module after start-up: long texts that only one screen shows (the legal documents) are loaded
 * with that screen instead of with the app, then read through t() like any other key.
 */
export function registerStrings(ns: string, dict: ModuleDict): void {
  const mod = MODULES[ns] ?? (MODULES[ns] = { ar: {}, en: {} })
  Object.assign(mod.ar, dict.ar)
  Object.assign(mod.en, dict.en)
}

const LANG_KEY = 'dentora.lang'
export function storedLang(): Lang {
  try { const v = localStorage.getItem(LANG_KEY); if (v === 'en' || v === 'ar') return v } catch { /* ignore */ }
  return 'ar'
}

// ---- plurals ------------------------------------------------------------------------------------------
// Arabic counts have six forms (CLDR): zero (0), one (1), two (2), few (3–10), many (11–99) and other (100, 101, 102,
// fractions…); English has one and other. A counted phrase is written in one of two ways:
//   1. an ICU plural block inside the string:  'متبقٍ {days, plural, one {يوم واحد} two {يومان} few {# أيام} many {# يوماً} other {# يوم}}'
//      (any of zero/one/two/few/many/other or an exact =N; '#' is the number; other params work inside the branches);
//   2. one key per form, '<key>_<form>', read with tn(t, lang, '<key>', n): a missing form falls back to '<key>_other'.
export type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
const pluralRules = new Map<string, Intl.PluralRules>()
/** The CLDR plural form of n: pluralForm(3, 'ar') → 'few', pluralForm(11, 'ar') → 'many', pluralForm(1, 'en') → 'one'. */
export function pluralForm(n: number, lang: Lang | string): PluralForm {
  const l = lang === 'ar' ? 'ar' : 'en'
  try {
    let r = pluralRules.get(l)
    if (!r) { r = new Intl.PluralRules(l); pluralRules.set(l, r) }
    return r.select(n) as PluralForm
  } catch {
    // old engines without Intl.PluralRules: the same rules by hand
    if (l === 'en') return n === 1 ? 'one' : 'other'
    if (!Number.isInteger(n)) return 'other'
    const m = Math.abs(n) % 100
    return n === 0 ? 'zero' : n === 1 ? 'one' : n === 2 ? 'two' : m >= 3 && m <= 10 ? 'few' : m >= 11 ? 'many' : 'other'
  }
}

/** Index of the brace closing the one opened at `open`, or -1. */
function closingBrace(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}' && --depth === 0) return i
  }
  return -1
}
const PLURAL_HEAD = /^\{\s*([\w.]+)\s*,\s*plural\s*,/
/** Resolves every '{name, plural, …}' block of s with the value of params[name]. Unknown or broken blocks are left as they are. */
export function resolvePlurals(s: string, lang: Lang, params: Record<string, string | number>): string {
  if (!s.includes('plural')) return s
  let out = ''
  let i = 0
  while (i < s.length) {
    const open = s.indexOf('{', i)
    if (open < 0) { out += s.slice(i); break }
    const head = PLURAL_HEAD.exec(s.slice(open))
    const close = head ? closingBrace(s, open) : -1
    if (!head || close < 0 || !(head[1] in params)) { out += s.slice(i, open + 1); i = open + 1; continue }
    const n = Number(params[head[1]])
    const branches = new Map<string, string>()
    let j = open + head[0].length
    while (j < close) {
      const sel = /^\s*(=\d+(?:\.\d+)?|zero|one|two|few|many|other)\s*\{/.exec(s.slice(j, close))
      if (!sel) break
      const bOpen = j + sel[0].length - 1
      const bClose = closingBrace(s, bOpen)
      if (bClose < 0 || bClose > close) break
      branches.set(sel[1], s.slice(bOpen + 1, bClose))
      j = bClose + 1
    }
    const text = (Number.isFinite(n) ? branches.get(`=${n}`) ?? branches.get(pluralForm(n, lang)) : undefined) ?? branches.get('other')
    out += s.slice(i, open) + (text === undefined ? s.slice(open, close + 1) : resolvePlurals(text, lang, params).split('#').join(String(params[head[1]])))
    i = close + 1
  }
  return out
}

/**
 * Looks a key up: 'patients.title' → MODULES.patients[lang].title; a bare key ('save') is read from common.
 * Missing in the current language → the other language → the key itself (so a missing string is visible, never a crash).
 * Plural blocks ('{n, plural, …}') are resolved first, then '{param}' placeholders.
 */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dot = key.indexOf('.')
  const s = lookup(lang, key) ?? (dot > 0 && MODULES[key.slice(0, dot)] ? key.slice(dot + 1) : key)
  return params ? fill(s, lang, params) : s
}
function fill(s: string, lang: Lang, params: Record<string, string | number>): string {
  let out = resolvePlurals(s, lang, params)
  for (const [p, v] of Object.entries(params)) out = out.split(`{${p}}`).join(String(v))
  return out
}
/** The raw string of a key (current language, then the other one), or undefined when no dictionary has it. */
function lookup(lang: Lang, key: string): string | undefined {
  const dot = key.indexOf('.')
  let ns = 'common', k = key
  if (dot > 0) { const cand = key.slice(0, dot); if (MODULES[cand]) { ns = cand; k = key.slice(dot + 1) } }
  const mod = MODULES[ns]
  let s: string | undefined = mod?.[lang]?.[k] ?? mod?.[lang === 'ar' ? 'en' : 'ar']?.[k]
  if (s === undefined && ns !== 'common') s = common[lang][key] ?? common[lang === 'ar' ? 'en' : 'ar'][key]
  return s
}
/** True when some dictionary has this key (in either language). */
export function hasKey(key: string): boolean { return lookup('ar', key) !== undefined }

type TFn = (key: string, params?: Record<string, string | number>) => string
/**
 * A counted phrase written as one key per form: tn(t, lang, 'inventory.itemsCount', 3) reads 'inventory.itemsCount_few'
 * (falling back to '_other', then to the bare key, which may hold an ICU plural block). `n` is passed as {n}.
 */
export function tn(t: TFn, lang: Lang | string, key: string, n: number, params: Record<string, string | number> = {}): string {
  const p = { n, ...params }
  const form = pluralForm(n, lang)
  for (const k of [`${key}_${form}`, `${key}_other`]) if (hasKey(k)) return t(k, p)
  return t(key, p)
}

export interface I18n {
  lang: Lang
  dir: 'rtl' | 'ltr'
  isRTL: boolean
  t: (key: string, params?: Record<string, string | number>) => string
  /** A counted phrase: tn('inventory.itemsCount', 3) → '3 أصناف' (see tn() above). */
  tn: (key: string, n: number, params?: Record<string, string | number>) => string
  setLang: (l: Lang) => void
  /** Picks the right field of a bilingual record: name / nameEn. */
  pick: (ar?: string, en?: string) => string
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial ?? storedLang())
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    try { localStorage.setItem(LANG_KEY, lang) } catch { /* ignore */ }
  }, [lang])
  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(lang, key, params), [lang])
  const value = useMemo<I18n>(() => ({
    lang, dir: lang === 'ar' ? 'rtl' : 'ltr', isRTL: lang === 'ar', t, setLang: setLangState,
    tn: (key: string, n: number, params?: Record<string, string | number>) => tn(t, lang, key, n, params),
    pick: (ar?: string, en?: string) => (lang === 'en' ? (en || ar || '') : (ar || en || '')),
  }), [lang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}
/** t() for the UI kit: falls back to English outside the provider instead of throwing. */
export function useTSafe(): I18n['t'] {
  const v = useContext(Ctx)
  return v?.t ?? ((key: string, params?: Record<string, string | number>) => translate('en', key, params))
}
/** Shorthand: const t = useT() */
export function useT() { return useI18n().t }
