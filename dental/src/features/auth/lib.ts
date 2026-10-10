// Pure helpers of the auth module (setup wizard + login). No React, no database: covered by tests/auth.test.ts.
import type { Clinic, Lang } from '@/db/types'

// ---- currencies -------------------------------------------------------------------------------
export interface CurrencyPreset { code: string; symbol: string; decimals: 0 | 2 }

/** The currencies clinics in the region use, with the symbol printed on invoices and the usual decimals. */
export const CURRENCIES: CurrencyPreset[] = [
  { code: 'USD', symbol: '$', decimals: 2 },
  { code: 'SYP', symbol: 'ل.س', decimals: 0 },
  { code: 'SAR', symbol: 'ر.س', decimals: 2 },
  { code: 'AED', symbol: 'د.إ', decimals: 2 },
  { code: 'EGP', symbol: 'ج.م', decimals: 2 },
  { code: 'JOD', symbol: 'د.أ', decimals: 2 },
  { code: 'IQD', symbol: 'د.ع', decimals: 0 },
  { code: 'KWD', symbol: 'د.ك', decimals: 2 },
  { code: 'QAR', symbol: 'ر.ق', decimals: 2 },
  { code: 'OMR', symbol: 'ر.ع', decimals: 2 },
  { code: 'BHD', symbol: 'د.ب', decimals: 2 },
  { code: 'LBP', symbol: 'ل.ل', decimals: 0 },
  { code: 'TRY', symbol: '₺', decimals: 2 },
  { code: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', symbol: '£', decimals: 2 },
  { code: 'MAD', symbol: 'د.م', decimals: 2 },
  { code: 'DZD', symbol: 'د.ج', decimals: 2 },
  { code: 'TND', symbol: 'د.ت', decimals: 2 },
  { code: 'LYD', symbol: 'د.ل', decimals: 2 },
]
/** Select value for "another currency" (code and symbol typed by hand). */
export const CUSTOM_CURRENCY = 'custom'

export function currencyPreset(code: string): CurrencyPreset | undefined {
  const c = (code || '').trim().toUpperCase()
  return CURRENCIES.find(p => p.code === c)
}
/** Decimals a currency is usually written with: the preset's, else 2. */
export function defaultDecimals(code: string): 0 | 2 {
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
export const MAX_ATTEMPTS = 5
export const LOCK_MS = 30_000
/** Failed attempts since the last success, and the instant (epoch ms) a lock ends (0 = not locked). */
export interface LoginGuard { fails: number; until: number }
export const FRESH_GUARD: LoginGuard = { fails: 0, until: 0 }

/** A lock that has run out starts a fresh round of attempts. */
export function normalizeGuard(g: LoginGuard, now: number): LoginGuard {
  return g.until && g.until <= now ? FRESH_GUARD : g
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
/** One more wrong PIN. The fifth in a row locks the pad for 30 seconds. */
export function registerFailure(g: LoginGuard, now: number): LoginGuard {
  const n = normalizeGuard(g, now)
  if (isLocked(n, now)) return n
  const fails = n.fails + 1
  return fails >= MAX_ATTEMPTS ? { fails, until: now + LOCK_MS } : { fails, until: 0 }
}
/** Reads the guard kept in localStorage; anything unreadable is a fresh guard. */
export function parseGuard(raw: string | null | undefined): LoginGuard {
  try {
    const v = JSON.parse(raw || 'null')
    if (v && Number.isFinite(v.fails) && Number.isFinite(v.until) && v.fails >= 0) return { fails: Math.floor(v.fails), until: v.until }
  } catch { /* fall through */ }
  return FRESH_GUARD
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
  decimals: 0 | 2
  workingDays: number[]            // 0 = Sunday … 6 = Saturday
  workStart: string                // 'HH:MM'
  workEnd: string
  slotMinutes: number
  taxPercent: number | null
}
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

/** Everything the wizard writes into the clinic record (setupDone is set separately). */
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
  }
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
