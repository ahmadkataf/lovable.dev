import type { ISODate, Lang } from '@/db/types'

export const DAY_MS = 86_400_000

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** 'YYYY-MM-DD' → local midnight. */
export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
export function today(): ISODate { return toISODate(new Date()) }
export function addDays(s: ISODate, n: number): ISODate { const d = fromISODate(s); d.setDate(d.getDate() + n); return toISODate(d) }
/** 2026-01-31 + 1 month → 2026-02-28 (clamped to the target month, never spilling into the next one). */
export function addMonths(s: ISODate, n: number): ISODate {
  const d = fromISODate(s)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), last))
  return toISODate(target)
}
export function startOfWeek(s: ISODate, weekStart = 6): ISODate {   // Saturday by default (Levant)
  const d = fromISODate(s); const diff = (d.getDay() - weekStart + 7) % 7; d.setDate(d.getDate() - diff); return toISODate(d)
}
export function startOfMonth(s: ISODate): ISODate { return s.slice(0, 7) + '-01' }
export function endOfMonth(s: ISODate): ISODate { const d = fromISODate(s); return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
export function daysInMonth(s: ISODate): number { const d = fromISODate(s); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }
export function diffDays(a: ISODate, b: ISODate): number { return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / DAY_MS) }
export function isSameDay(a: Date, b: Date): boolean { return toISODate(a) === toISODate(b) }
export function dateOf(iso: string): ISODate { return toISODate(new Date(iso)) }

/** 'HH:MM' → minutes since midnight, and back. */
export function timeToMinutes(t: string): number { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
export function minutesToTime(min: number): string { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
/** A date + 'HH:MM' → ISO instant in local time. */
export function combine(date: ISODate, time: string): string { const d = fromISODate(date); const m = timeToMinutes(time); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.toISOString() }
export function timeOf(iso: string): string { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export function ageFrom(birth?: ISODate, at: Date = new Date()): number | null {
  if (!birth) return null
  const b = fromISODate(birth)
  let age = at.getFullYear() - b.getFullYear()
  const m = at.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age--
  return age >= 0 && age < 150 ? age : null
}

const cache = new Map<string, Intl.DateTimeFormat>()
let arabicMonths: 'levant' | 'standard' = 'levant'
/** تشرين/كانون (Levant, Iraq) or يناير/فبراير (Gulf, Egypt, Maghreb). Set once from the clinic (App). */
export function setArabicMonthStyle(style: 'levant' | 'standard') {
  if (style === arabicMonths) return
  arabicMonths = style; cache.clear()
}
export const getArabicMonthStyle = () => arabicMonths
/** Countries whose Arabic uses the Syriac month names. */
export const LEVANT_COUNTRIES = new Set(['963', '961', '962', '964', '970'])
const locale = (lang: Lang) => (lang === 'ar' ? (arabicMonths === 'levant' ? 'ar-SY-u-nu-latn' : 'ar-EG-u-nu-latn') : 'en-GB')
function dtf(lang: Lang, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = lang + JSON.stringify(opts)
  let f = cache.get(key)
  if (!f) { f = new Intl.DateTimeFormat(locale(lang), opts); cache.set(key, f) }
  return f
}
export function fmtDate(d: ISODate | Date | string, lang: Lang, style: 'short' | 'medium' | 'long' | 'weekday' = 'medium'): string {
  const date = typeof d === 'string' ? (d.length === 10 ? fromISODate(d) : new Date(d)) : d
  if (Number.isNaN(date.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions =
    style === 'short' ? { day: '2-digit', month: '2-digit', year: 'numeric' }
    : style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' }
    : style === 'weekday' ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'short', year: 'numeric' }
  return dtf(lang, opts).format(date)
}
export function fmtTime(d: string | Date, lang: Lang): string {
  const date = typeof d === 'string' ? (d.length <= 5 ? fromISODate(today()) : new Date(d)) : d
  if (typeof d === 'string' && d.length <= 5) { const m = timeToMinutes(d); date.setHours(Math.floor(m / 60), m % 60) }
  return dtf(lang, { hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
}
export function fmtDateTime(d: string | Date, lang: Lang): string { return `${fmtDate(d, lang)} · ${fmtTime(d, lang)}` }
export function fmtMonth(d: ISODate, lang: Lang): string { return dtf(lang, { month: 'long', year: 'numeric' }).format(fromISODate(d)) }
export function weekdayName(dayIndex: number, lang: Lang, width: 'long' | 'short' = 'long'): string {
  const d = new Date(2024, 0, 7 + dayIndex)  // 2024-01-07 is a Sunday
  return dtf(lang, { weekday: width }).format(d)
}
export function relativeDay(d: ISODate, lang: Lang): string {
  const diff = diffDays(today(), d)
  if (diff === 0) return lang === 'ar' ? 'اليوم' : 'Today'
  if (diff === 1) return lang === 'ar' ? 'غداً' : 'Tomorrow'
  if (diff === -1) return lang === 'ar' ? 'أمس' : 'Yesterday'
  return fmtDate(d, lang, 'weekday')
}
export function timeAgo(iso: string, lang: Lang): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
  if (s < 60) return lang === 'ar' ? 'الآن' : 'just now'
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour')
  if (s < 86400 * 30) return rtf.format(-Math.floor(s / 86400), 'day')
  return fmtDate(iso, lang)
}
/** Inclusive list of ISO dates. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d)
  return out
}
