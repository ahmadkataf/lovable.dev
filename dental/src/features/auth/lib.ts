// Pure helpers of the auth module (setup wizard + login). No React, no database: covered by tests/auth.test.ts.
import type { Clinic, Lang } from '@/db/types'
import { countryCodeFor } from '@/lib/format'
import { LEVANT_COUNTRIES } from '@/lib/dates'

// ---- currencies -------------------------------------------------------------------------------
export type Decimals = 0 | 2 | 3
export interface CurrencyPreset { code: string; symbol: string; decimals: Decimals }

/**
 * The currencies clinics in the region use, with the symbol printed on invoices and the usual decimals.
 * The Kuwaiti, Bahraini and Jordanian dinars and the Omani rial are divided into 1000 fils (baisa), so they keep
 * 3 decimals: VAT invoices in Bahrain and Oman are kept in fils.
 */
export const CURRENCIES: CurrencyPreset[] = [
  { code: 'USD', symbol: '$', decimals: 2 },
  { code: 'SYP', symbol: 'ل.س', decimals: 0 },
  { code: 'SAR', symbol: 'ر.س', decimals: 2 },
  { code: 'AED', symbol: 'د.إ', decimals: 2 },
  { code: 'EGP', symbol: 'ج.م', decimals: 2 },
  { code: 'JOD', symbol: 'د.أ', decimals: 3 },
  { code: 'IQD', symbol: 'د.ع', decimals: 0 },
  { code: 'KWD', symbol: 'د.ك', decimals: 3 },
  { code: 'QAR', symbol: 'ر.ق', decimals: 2 },
  { code: 'OMR', symbol: 'ر.ع', decimals: 3 },
  { code: 'BHD', symbol: 'د.ب', decimals: 3 },
  { code: 'LBP', symbol: 'ل.ل', decimals: 0 },
  { code: 'TRY', symbol: '₺', decimals: 2 },
  { code: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', symbol: '£', decimals: 2 },
  { code: 'MAD', symbol: 'د.م', decimals: 2 },
  { code: 'DZD', symbol: 'د.ج', decimals: 2 },
  { code: 'TND', symbol: 'د.ت', decimals: 3 },
  { code: 'LYD', symbol: 'د.ل', decimals: 3 },
]
/** Select value for "another currency" (code and symbol typed by hand). */
export const CUSTOM_CURRENCY = 'custom'

export function currencyPreset(code: string): CurrencyPreset | undefined {
  const c = (code || '').trim().toUpperCase()
  return CURRENCIES.find(p => p.code === c)
}
/** Decimals a currency is usually written with: the preset's, else 2. */
export function defaultDecimals(code: string): Decimals {
  return currencyPreset(code)?.decimals ?? 2
}
/** Custom codes are 2–4 Latin letters, upper-cased. */
export function cleanCurrencyCode(s: string): string {
  return (s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
}
export const isValidCurrencyCode = (s: string) => /^[A-Z]{2,4}$/.test(s)

/** The three clinic fields for the chosen currency (preset or custom). */
export function resolveCurrency(m: Pick<MoneyDraft, 'currency' | 'customCode' | 'customSymbol' | 'decimals'>): Pick<Clinic, 'currency' | 'currencySymbol' | 'currencyDecimals'> {
  if (m.currency === CUSTOM_CURRENCY) {
    const code = cleanCurrencyCode(m.customCode)
    return { currency: code, currencySymbol: m.customSymbol.trim() || code, currencyDecimals: m.decimals }
  }
  const p = currencyPreset(m.currency) ?? CURRENCIES[0]
  return { currency: p.code, currencySymbol: p.symbol, currencyDecimals: m.decimals }
}

// ---- digits & PIN -----------------------------------------------------------------------------
export const PIN_MIN = 4
export const PIN_MAX = 6

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → Latin, so a PIN typed on an Arabic keyboard still works. */
export function normalizeDigits(s: string): string {
  return (s || '')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
}
/** What a PIN field keeps of the typed text: digits only, at most 6. */
export function sanitizePin(s: string): string {
  return normalizeDigits(s).replace(/\D/g, '').slice(0, PIN_MAX)
}
export type PinError = 'required' | 'format' | 'mismatch'
/** Validation of a new PIN and its confirmation. `confirm` undefined = no confirmation field. */
export function pinError(pin: string, confirm?: string): PinError | null {
  const p = (pin || '').trim()
  if (!p) return 'required'
  if (!/^\d{4,6}$/.test(p)) return 'format'
  if (confirm !== undefined && confirm.trim() !== p) return 'mismatch'
  return null
}
/** i18n key of a PIN error. */
export function pinErrorKey(e: PinError): string {
  return e === 'required' ? 'v.required' : e === 'format' ? 'v.pin' : 'auth.v.pinMismatch'
}
/** How many dots the login screen shows: at least 4, one spare slot after the 4th digit, at most 6. */
export function dotCount(len: number): number {
  return Math.max(PIN_MIN, Math.min(PIN_MAX, len + 1))
}

// ---- login lockout ----------------------------------------------------------------------------
// Five wrong PINs in a row lock that user's PIN pad. Each further lock lasts longer (30 s, 1 min, 5 min, 15 min,
// 30 min, then an hour), until the right PIN is entered; a day without mistakes starts over. The guard is kept
// per user, in the database and in localStorage (see guardStore.ts), so closing or reloading the app does not
// reset it.
export const MAX_ATTEMPTS = 5
export const LOCK_STEPS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000]
/** The first lock (30 seconds). */
export const LOCK_MS = LOCK_STEPS_MS[0]
/** After this long without a wrong PIN, the escalation starts over. */
export const GUARD_FORGET_MS = 24 * 3_600_000
/**
 * Wrong attempts in the current round, the instant (epoch ms) a lock ends (0 = not locked), how many locks
 * there have been since the last good PIN, and the instant of the last wrong PIN.
 */
export interface LoginGuard { fails: number; until: number; locks: number; last: number }
export const FRESH_GUARD: LoginGuard = { fails: 0, until: 0, locks: 0, last: 0 }

/** How long the n-th lock lasts (n ≥ 1). */
export function lockDuration(n: number): number {
  return LOCK_STEPS_MS[Math.min(Math.max(1, n), LOCK_STEPS_MS.length) - 1]
}
/** A lock that has run out starts a fresh round of attempts; a quiet day forgets the escalation too. */
export function normalizeGuard(g: LoginGuard, now: number): LoginGuard {
  if (g.until > now) return g
  if (g.last && now - g.last >= GUARD_FORGET_MS) return FRESH_GUARD
  if (g.until && g.until <= now) return { fails: 0, until: 0, locks: g.locks, last: g.last }
  return g
}
export function isLocked(g: LoginGuard, now: number): boolean {
  return g.until > now
}
/** Milliseconds until the pad unlocks (0 when not locked). */
export function lockRemaining(g: LoginGuard, now: number): number {
  return Math.max(0, g.until - now)
}
export function attemptsLeft(g: LoginGuard, now: number): number {
  const n = normalizeGuard(g, now)
  return isLocked(n, now) ? 0 : Math.max(0, MAX_ATTEMPTS - n.fails)
}
/** One more wrong PIN. The fifth in a row locks the pad, each lock longer than the one before. */
export function registerFailure(g: LoginGuard, now: number): LoginGuard {
  const n = normalizeGuard(g, now)
  if (isLocked(n, now)) return n
  const fails = n.fails + 1
  if (fails < MAX_ATTEMPTS) return { fails, until: 0, locks: n.locks, last: now }
  const locks = n.locks + 1
  return { fails, until: now + lockDuration(locks), locks, last: now }
}
/** A stored guard (object or JSON text); anything unreadable is a fresh guard. Older guards had no locks/last. */
export function parseGuard(raw: unknown): LoginGuard {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw || 'null') : raw
    if (v && typeof v === 'object' && Number.isFinite(v.fails) && Number.isFinite(v.until) && v.fails >= 0) {
      const locks = Number.isFinite(v.locks) && v.locks >= 0 ? Math.floor(v.locks) : 0
      const last = Number.isFinite(v.last) && v.last >= 0 ? v.last : 0
      return { fails: Math.floor(v.fails), until: v.until, locks, last }
    }
  } catch { /* fall through */ }
  return FRESH_GUARD
}
/** userId → guard, from a stored map; entries that cannot be read are left out. */
export function parseGuards(raw: unknown): Record<string, LoginGuard> {
  let v: unknown = raw
  try { if (typeof raw === 'string') v = JSON.parse(raw || 'null') } catch { return {} }
  const out: Record<string, LoginGuard> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [id, g] of Object.entries(v as Record<string, unknown>)) {
    const p = parseGuard(g)
    if (p !== FRESH_GUARD) out[id] = p
  }
  return out
}
/** The stricter of two copies of a user's guard (the database's and localStorage's): clearing one copy gains nothing. */
export function stricterGuard(a: LoginGuard | undefined, b: LoginGuard | undefined): LoginGuard {
  if (!a) return b ?? FRESH_GUARD
  if (!b) return a
  const newer = b.last > a.last ? b : a
  return { fails: newer.fails, until: Math.max(a.until, b.until), locks: Math.max(a.locks, b.locks), last: Math.max(a.last, b.last) }
}
export function mergeGuards(a: Record<string, LoginGuard>, b: Record<string, LoginGuard>): Record<string, LoginGuard> {
  const out: Record<string, LoginGuard> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) out[id] = stricterGuard(a[id], b[id])
  return out
}
/** 25_000 → "0:25" (the lock countdown). */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ---- setup wizard -----------------------------------------------------------------------------
export interface ClinicDraft { name: string; phone: string; address: string; email: string; logo?: string }
export interface MoneyDraft {
  currency: string                 // preset code or CUSTOM_CURRENCY
  customCode: string
  customSymbol: string
  decimals: Decimals
  workingDays: number[]            // 0 = Sunday … 6 = Saturday
  workStart: string                // 'HH:MM'
  workEnd: string
  slotMinutes: number
  taxPercent: number | null
  countryCode?: string             // phone country code without + (963…); '' or missing = the one the currency suggests
  arabicMonths?: MonthChoice       // Arabic month names; 'auto' or missing = the usual ones of the country
}
/** Arabic month names: كانون الثاني/شباط (Levant, Iraq), يناير/فبراير (elsewhere), or the country's usual ones. */
export type MonthChoice = 'auto' | 'levant' | 'standard'
export interface OwnerDraft { name: string; title: string; specialty: string; phone: string; pin: string; pin2: string }
/** Field → i18n key of its error. Empty object = the step is valid. */
export type Errors = Record<string, string>

export const SLOT_OPTIONS = [15, 20, 30, 60]
/** Week as clinics in the Levant read it: Saturday first. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]

export function isEmail(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim()) }
/** Loose phone check: digits with optional +, spaces, dashes and brackets; 6 to 15 digits. */
export function isPhone(s: string): boolean {
  const v = normalizeDigits(s || '').trim()
  if (!/^\+?[\d\s\-()]+$/.test(v)) return false
  const d = v.replace(/\D/g, '').length
  return d >= 6 && d <= 15
}
export function timeToMin(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

export function validateClinicStep(d: ClinicDraft): Errors {
  const e: Errors = {}
  if (!d.name.trim()) e.name = 'v.required'
  if (d.phone.trim() && !isPhone(d.phone)) e.phone = 'v.phone'
  if (d.email.trim() && !isEmail(d.email)) e.email = 'v.email'
  return e
}
export function validateMoneyStep(m: MoneyDraft): Errors {
  const e: Errors = {}
  if (m.currency === CUSTOM_CURRENCY) {
    if (!isValidCurrencyCode(cleanCurrencyCode(m.customCode))) e.customCode = m.customCode.trim() ? 'auth.v.code' : 'v.required'
    if (!m.customSymbol.trim()) e.customSymbol = 'v.required'
  }
  if (!m.workingDays.length) e.workingDays = 'auth.v.days'
  const a = timeToMin(m.workStart), b = timeToMin(m.workEnd)
  if (Number.isNaN(a)) e.workStart = 'v.required'
  if (Number.isNaN(b)) e.workEnd = 'v.required'
  else if (!Number.isNaN(a) && b <= a) e.workEnd = 'auth.v.hours'
  if (m.taxPercent !== null && (!Number.isFinite(m.taxPercent) || m.taxPercent < 0 || m.taxPercent > 100)) e.taxPercent = 'auth.v.tax'
  return e
}
export function validateOwnerStep(o: OwnerDraft): Errors {
  const e: Errors = {}
  if (!o.name.trim()) e.name = 'v.required'
  if (o.phone.trim() && !isPhone(o.phone)) e.phone = 'v.phone'
  const p = pinError(o.pin)
  if (p) e.pin = pinErrorKey(p)
  else { const c = pinError(o.pin, o.pin2); if (c) e.pin2 = o.pin2 ? pinErrorKey(c) : 'v.required' }
  return e
}

/** Adds or removes a weekday, keeping the list sorted. */
export function toggleDay(days: number[], d: number): number[] {
  return (days.includes(d) ? days.filter(x => x !== d) : [...days, d]).sort((a, b) => a - b)
}
/** Working days in display order (Saturday first). */
export function orderedDays(days: number[]): number[] {
  return WEEK_ORDER.filter(d => days.includes(d))
}

const isCountryCode = (s: unknown): s is string => typeof s === 'string' && /^\d{1,4}$/.test(s)
/** The country the wizard shows and the clinic will use: the one picked, else the one its currency suggests, else Syria. */
export function setupCountry(m: Pick<MoneyDraft, 'currency' | 'customCode' | 'customSymbol' | 'decimals' | 'countryCode'>): string {
  return (isCountryCode(m.countryCode) ? m.countryCode : '') || countryCodeFor(resolveCurrency(m).currency) || '963'
}
/** The Arabic month names the clinic will print: the ones picked, else the usual ones of its country. */
export function setupMonths(m: Pick<MoneyDraft, 'currency' | 'customCode' | 'customSymbol' | 'decimals' | 'countryCode' | 'arabicMonths'>): 'levant' | 'standard' {
  if (m.arabicMonths === 'levant' || m.arabicMonths === 'standard') return m.arabicMonths
  return LEVANT_COUNTRIES.has(setupCountry(m)) ? 'levant' : 'standard'
}

/**
 * Everything the wizard writes into the clinic record (setupDone is set separately). A country or month style left
 * on automatic is stored as such (countryCode '', no arabicMonths), so it keeps following the currency as in Settings.
 */
export function buildClinicPatch(lang: Lang, c: ClinicDraft, m: MoneyDraft): Partial<Clinic> {
  const slot = SLOT_OPTIONS.includes(m.slotMinutes) ? m.slotMinutes : 30
  return {
    name: c.name.trim(),
    phone: c.phone.trim() || undefined,
    address: c.address.trim() || undefined,
    email: c.email.trim() || undefined,
    logo: c.logo || undefined,
    ...resolveCurrency(m),
    lang,
    workingDays: [...m.workingDays].sort((a, b) => a - b),
    workStart: m.workStart,
    workEnd: m.workEnd,
    slotMinutes: slot,
    defaultAppointmentMinutes: Math.max(30, slot),
    taxPercent: m.taxPercent && m.taxPercent > 0 ? Math.round(m.taxPercent * 100) / 100 : 0,
    countryCode: isCountryCode(m.countryCode) ? m.countryCode : '',
    ...(m.arabicMonths === 'levant' || m.arabicMonths === 'standard' ? { arabicMonths: m.arabicMonths } : {}),
  }
}

/** The title the owner starts with in each language (the wizard's default until it is chosen by hand). Same strings as auth.owner.titleAr/En. */
export function ownerTitleFor(lang: Lang): string {
  return lang === 'ar' ? 'د.' : 'Dr.'
}
/** "د. أحمد" — the title in front of the name, unless the name already starts with it. */
export function displayName(u: { name: string; title?: string }): string {
  const name = (u.name || '').trim()
  const title = (u.title || '').trim()
  if (!title || name.startsWith(title)) return name
  return `${title} ${name}`
}
/** The name without a leading title ("د. أحمد" → "أحمد"), for avatar initials. */
export function plainName(name: string): string {
  const n = (name || '').trim()
  const stripped = n.replace(/^(د\.|دكتور|Dr\.?)\s+/i, '').trim()
  return stripped || n
}
/** Morning greeting until 12:00, evening after. */
export function greetingKey(hour: number): 'goodMorning' | 'goodEvening' {
  return hour >= 4 && hour < 12 ? 'goodMorning' : 'goodEvening'
}

/** The accounts an admin PIN reset can be applied to: admins, active ones first, then by name. */
export function sortAdminsForReset<T extends { role: string; active: boolean; name: string }>(users: T[]): T[] {
  return users.filter(u => u.role === 'admin').sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'ar'))
}
/** Digits after which the sign-in screen checks the PIN by itself: the user's PIN length when known, else 6. */
export function autoSubmitLength(pinLength: number | null): number {
  return pinLength && pinLength >= PIN_MIN && pinLength <= PIN_MAX ? pinLength : PIN_MAX
}
