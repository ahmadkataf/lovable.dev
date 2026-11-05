// Small helpers: Damascus dates, Arabic phrasing, audit log, request parsing.
import type { Context } from 'hono'
import { ApiError } from './types'

const DAMASCUS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Today's date (YYYY-MM-DD) in Damascus local time. */
export const today = (): string => DAMASCUS.format(new Date())

export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))

/** 0 = الأحد … 4 = الخميس, 5 = الجمعة, 6 = السبت (same numbering as the timetable). */
export const weekday = (date: string): number => new Date(date + 'T00:00:00Z').getUTCDay()
export const isSchoolDay = (date: string): boolean => weekday(date) <= 4

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The last `n` school days (Sun–Thu) ending at or before `date`, most recent first. */
export function schoolDaysBack(date: string, n: number): string[] {
  const out: string[] = []
  for (let d = date; out.length < n; d = addDays(d, -1)) if (isSchoolDay(d)) out.push(d)
  return out
}

/** The latest school day on or before `date` (Friday/Saturday → the Thursday before). */
export function lastSchoolDay(date: string): string {
  let d = date
  while (!isSchoolDay(d)) d = addDays(d, -1)
  return d
}
/** The day the management views show by default: today, or on the weekend the last school day (the demo seed anchors to it). */
export const reportDate = (): string => lastSchoolDay(today())

/** Sunday of the week that contains `date` (the school week runs Sun–Thu). */
export const weekStart = (date: string): string => addDays(date, -weekday(date))
export const monthStart = (date: string): string => date.slice(0, 8) + '01'
export const nextMonthStart = (date: string): string => monthStart(addDays(monthStart(date), 31))

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
/** Levantine month names (the same list the client uses). */
export const MONTH_NAMES = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']
export const ORDINALS = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة']

/** Period start times per shift (45-minute periods, a long break after the third). */
const PERIOD_STARTS = [
  ['07:30', '08:20', '09:10', '10:15', '11:05', '11:55', '12:45'],
  ['12:30', '13:20', '14:10', '15:15', '16:05', '16:55', '17:45'],
]
export const periodStart = (shift: number, period: number): string => PERIOD_STARTS[shift === 2 ? 1 : 0][Math.min(Math.max(period, 1), 7) - 1]

/** Arabic-Indic digits for notification bodies (the UI shows them too). */
export const arDigits = (n: number | string): string => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)])

/** Arabic count agreement: 1 → singular, 2 → dual, 3–10 → N plural, 11+ → N singular-accusative. */
export function countPhrase(n: number, forms: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return forms.one
  if (n === 2) return forms.two
  if (n >= 3 && n <= 10) return `${arDigits(n)} ${forms.few}`
  return `${arDigits(n)} ${forms.many}`
}
export const periodsPhrase = (n: number) => countPhrase(n, { one: 'حصّة واحدة', two: 'حصّتان', few: 'حصص', many: 'حصّة' })
export const schoolsPhrase = (n: number) => countPhrase(n, { one: 'مدرسة واحدة', two: 'مدرستان', few: 'مدارس', many: 'مدرسة' })
export const guardiansPhrase = (n: number) => countPhrase(n, { one: 'وليّ أمر واحد', two: 'وليَّي أمر', few: 'أولياء أمور', many: 'وليّ أمر' })
export const studentsPhrase = (n: number) => countPhrase(n, { one: 'طالب واحد', two: 'طالبان', few: 'طلاب', many: 'طالباً' })

/** The SMS gateway is phase 2: the demo version only simulates text messages, and every string that mentions them says so. */
export const SMS_SIMULATED = 'محاكاة في نسخة العرض'

/** Cuts a long text for a notification body at a word boundary and appends «…» (never mid-word, never a bare hard cut). */
export function ellipsize(text: string | null | undefined, max = 100): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const at = cut.lastIndexOf(' ')
  return (at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s،؛:·—-]+$/, '') + '…'
}

const NUMBER_WORDS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستّة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة']
/** Consecutive days: «يوم واحد» / «يومان متتاليان» / «ثلاثة أيام متتالية» (spelled out up to ten) / «١٢ يوماً متتالياً». */
export function daysPhrase(n: number): string {
  if (n === 1) return 'يوم واحد'
  if (n === 2) return 'يومان متتاليان'
  if (n >= 3 && n <= 10) return `${NUMBER_WORDS[n]} أيام متتالية`
  return `${arDigits(n)} يوماً متتالياً`
}

/** «اليوم» for today, otherwise «يوم الخميس ٦ تشرين الثاني». */
export function dayPhrase(date: string): string {
  if (date === today()) return 'اليوم'
  const [, m, d] = date.split('-').map(Number)
  return `يوم ${DAY_NAMES[weekday(date)]} ${arDigits(d)} ${MONTH_NAMES[m - 1]}`
}

/** Compound first names («عبد الرحمن», «عبد الله», «أبو بكر», «أم كلثوم») are kept whole. */
const COMPOUND_FIRST = new Set(['عبد', 'أبو', 'ابو', 'أم', 'ام'])
export function firstName(name: string): string {
  const parts = (name ?? '').trim().replace(/^أ\.\s*/, '').split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  return COMPOUND_FIRST.has(parts[0]) && parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0]
}

/** The preposition «ل» attached to a name: «لمحمد», «للحسن» (no tatweel). */
export function li(word: string): string {
  const w = (word ?? '').trim()
  if (!w) return ''
  return w.startsWith('ال') ? `لل${w.slice(2)}` : `ل${w}`
}

/** Every write records who did what to what. */
export async function audit(db: D1Database, userId: number | null, action: string, target: string | number | null = null): Promise<void> {
  await db.prepare('INSERT INTO audit_log (user_id, action, target) VALUES (?, ?, ?)').bind(userId, action, target === null ? null : String(target)).run()
}

export async function readBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json()
    return b && typeof b === 'object' && !Array.isArray(b) ? b as Record<string, unknown> : {}
  } catch { return {} }
}

export const bad = (msg = 'بيانات غير صالحة') => new ApiError(400, msg)
export const forbidden = (msg = 'غير مصرّح بهذا الإجراء') => new ApiError(403, msg)
export const notFound = (msg = 'غير موجود') => new ApiError(404, msg)

export function intParam(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : null
}
export function requireInt(v: unknown, what: string): number {
  const n = intParam(v)
  if (n === null) throw bad(`قيمة غير صالحة: ${what}`)
  return n
}
export function requireText(v: unknown, what: string, max = 2000): string {
  if (typeof v !== 'string' || !v.trim()) throw bad(`الحقل مطلوب: ${what}`)
  return v.trim().slice(0, max)
}
export const optText = (v: unknown, max = 2000): string | null => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

/** `?, ?, ?` for an IN (...) list. */
export const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(', ')
