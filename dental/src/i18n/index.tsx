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

export type { Dict, ModuleDict }
const MODULES: Record<string, ModuleDict> = { common, patients, chart, appointments, treatments, prescriptions, lab, billing, inventory, expenses, reports, dashboard, auth, staff, settings, license, search, seed }

const LANG_KEY = 'dentora.lang'
export function storedLang(): Lang {
  try { const v = localStorage.getItem(LANG_KEY); if (v === 'en' || v === 'ar') return v } catch { /* ignore */ }
  return 'ar'
}

/**
 * Looks a key up: 'patients.title' → MODULES.patients[lang].title; a bare key ('save') is read from common.
 * Missing in the current language → the other language → the key itself (so a missing string is visible, never a crash).
 */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dot = key.indexOf('.')
  let ns = 'common', k = key
  if (dot > 0) { const cand = key.slice(0, dot); if (MODULES[cand]) { ns = cand; k = key.slice(dot + 1) } }
  const mod = MODULES[ns]
  let s: string | undefined = mod?.[lang]?.[k] ?? mod?.[lang === 'ar' ? 'en' : 'ar']?.[k]
  if (s === undefined && ns !== 'common') s = common[lang][key] ?? common[lang === 'ar' ? 'en' : 'ar'][key]
  if (s === undefined) s = k
  if (params) for (const [p, v] of Object.entries(params)) s = s.split(`{${p}}`).join(String(v))
  return s
}

export interface I18n {
  lang: Lang
  dir: 'rtl' | 'ltr'
  isRTL: boolean
  t: (key: string, params?: Record<string, string | number>) => string
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
    pick: (ar?: string, en?: string) => (lang === 'en' ? (en || ar || '') : (ar || en || '')),
  }), [lang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}
/** Shorthand: const t = useT() */
export function useT() { return useI18n().t }
