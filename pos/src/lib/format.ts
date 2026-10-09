import { locale, t } from '../i18n'

const DAY = 86400000
export const MS_DAY = DAY

export function formatDate(ms: number, style: 'short' | 'long' = 'short'): string {
  const d = new Date(ms)
  return d.toLocaleDateString(locale(), style === 'long'
    ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' })
}
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}
export function formatDateTime(ms: number): string { return `${formatDate(ms)} ${formatTime(ms)}` }
export function formatMonth(ms: number): string { return new Date(ms).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) }
export function formatWeekday(ms: number): string { return new Date(ms).toLocaleDateString(locale(), { weekday: 'short' }) }

/** "today", "yesterday" or the date. */
export function formatDay(ms: number): string {
  const s = startOfDay(ms), today = startOfDay(Date.now())
  if (s === today) return t('common.today')
  if (s === today - DAY) return t('common.yesterday')
  return formatDate(ms)
}

export function startOfDay(ms: number): number { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }
export function endOfDay(ms: number): number { return startOfDay(ms) + DAY - 1 }
export function startOfWeek(ms: number, firstDay = 6): number {   // Saturday starts the week in the Levant
  const d = new Date(startOfDay(ms))
  const diff = (d.getDay() - firstDay + 7) % 7
  return d.getTime() - diff * DAY
}
export function startOfMonth(ms: number): number { const d = new Date(ms); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime() }
export function startOfYear(ms: number): number { const d = new Date(ms); d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d.getTime() }
export function addDays(ms: number, n: number): number { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime() }
export function addMonths(ms: number, n: number): number { const d = new Date(ms); d.setMonth(d.getMonth() + n); return d.getTime() }
/** For <input type="date">: 2026-10-09 in local time. */
export function toDateInput(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function fromDateInput(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).getTime()
}
export function daysBetween(a: number, b: number): number { return Math.round((startOfDay(b) - startOfDay(a)) / DAY) }

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'
export function periodRange(p: Period, custom?: { from: number; to: number }, now = Date.now()): { from: number; to: number } {
  switch (p) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': return { from: startOfDay(now) - DAY, to: startOfDay(now) - 1 }
    case 'week': return { from: startOfWeek(now), to: endOfDay(now) }
    case 'month': return { from: startOfMonth(now), to: endOfDay(now) }
    case 'year': return { from: startOfYear(now), to: endOfDay(now) }
    case 'custom': return custom ? { from: startOfDay(custom.from), to: endOfDay(custom.to) } : { from: startOfDay(now), to: endOfDay(now) }
  }
}

export function pluralAr(n: number, one: string, two: string, many: string, more: string): string {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${n} ${many}`
  return `${n} ${more}`
}
