// Time zone helpers (Intl-based, no dependencies). The centre's zone is settings.timezone (Asia/Damascus).
// All stored instants are ISO-8601 UTC strings; these helpers translate to/from the centre's local clock.

export interface LocalParts {
  y: number; m: number; d: number; hh: number; mm: number; ss: number
  date: string      // YYYY-MM-DD (local)
  minutes: number   // minutes since local midnight
  weekday: number   // 0 = Sunday … 6 = Saturday (local)
}

const cache = new Map<string, Intl.DateTimeFormat>()
function formatter(tz: string): Intl.DateTimeFormat {
  let f = cache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    cache.set(tz, f)
  }
  return f
}

export function isValidTimeZone(tz: string): boolean {
  try { formatter(tz); return true } catch { return false }
}

/** Local wall-clock components of a UTC instant. */
export function localParts(date: Date, tz: string): LocalParts {
  const parts: Record<string, number> = {}
  for (const p of formatter(tz).formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  const y = parts.year ?? 1970, m = parts.month ?? 1, d = parts.day ?? 1
  const hh = (parts.hour ?? 0) % 24, mm = parts.minute ?? 0, ss = parts.second ?? 0
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    y, m, d, hh, mm, ss,
    date: `${y}-${pad(m)}-${pad(d)}`,
    minutes: hh * 60 + mm,
    weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
  }
}

/** Offset of `tz` from UTC at `date`, in minutes (Damascus → 180). */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = localParts(date, tz)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss)
  const truncated = Math.floor(date.getTime() / 1000) * 1000
  return Math.round((asUtc - truncated) / 60000)
}

/** The UTC instant of a local date + "HH:MM" wall-clock time in `tz`. */
export function localToUtc(dateStr: string, time: string, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const off1 = tzOffsetMinutes(new Date(guess), tz)
  let utc = guess - off1 * 60000
  const off2 = tzOffsetMinutes(new Date(utc), tz)
  if (off2 !== off1) utc = guess - off2 * 60000
  return new Date(utc)
}

/** [start, end) of a local calendar day as UTC instants. */
export function localDayRange(dateStr: string, tz: string): { from: Date; to: Date } {
  const from = localToUtc(dateStr, '00:00', tz)
  const to = localToUtc(addDays(dateStr, 1), '00:00', tz)
  return { from, to }
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export const isDateString = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

export const isTimeString = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

/** "HH:MM" → minutes since midnight. */
export const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number) as [number, number]
  return h * 60 + m
}

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/** Human text for a booking window in the centre's zone, e.g. "الجمعة 24/10 · 10:00–12:00". */
export function formatWhen(start: string, end: string, tz: string): string {
  const s = localParts(new Date(start), tz), e = localParts(new Date(end), tz)
  const hm = (p: LocalParts) => `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`
  return `${WEEKDAYS_AR[s.weekday]} ${s.d}/${s.m} · ${hm(s)}–${hm(e)}`
}
