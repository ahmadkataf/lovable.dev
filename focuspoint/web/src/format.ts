// Dates, money and labels for the Focus Point UI. All ISO strings are UTC; display is in the centre's zone.
import type { BookingStatus } from '@shared/types'

export const TZ = 'Asia/Damascus'

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']

interface Parts { y: number; m: number; d: number; h: number; mi: number; wd: number }

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', weekday: 'short',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})
const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Wall-clock parts of an instant in the centre's time zone. */
function localParts(date: Date): Parts {
  const p: Record<string, string> = {}
  for (const part of partsFmt.formatToParts(date)) p[part.type] = part.value
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: WD_INDEX[p.weekday] ?? 0 }
}
/** Offset (ms) of the zone at the given UTC instant. */
function offsetAt(utcMs: number): number {
  const p = localParts(new Date(utcMs))
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(utcMs / 60000) * 60000
}
const pad = (n: number) => String(n).padStart(2, '0')

export function fmtDate(iso: string): string {
  const p = localParts(new Date(iso))
  return `${WEEKDAYS[p.wd]} ${p.d} ${MONTHS[p.m - 1]}`
}
export function fmtTime(iso: string): string {
  const p = localParts(new Date(iso))
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12
  return `${h12}:${pad(p.mi)} ${p.h < 12 ? 'ص' : 'م'}`
}
export function fmtRange(startIso: string, endIso: string): string {
  return `${fmtTime(startIso)} – ${fmtTime(endIso)}`
}
export function fmtSYP(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} ل.س`
}

/** Local date + time ("YYYY-MM-DD", "HH:MM") in the centre's zone → ISO UTC. */
export function fromLocal(dateYYYYMMDD: string, timeHHMM: string): string {
  const [y, m, d] = dateYYYYMMDD.split('-').map(Number)
  const [h, mi] = timeHHMM.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  let ts = guess - offsetAt(guess)
  const off2 = offsetAt(ts)
  if (guess - off2 !== ts) ts = guess - off2
  return new Date(ts).toISOString()
}
export function toLocalParts(iso: string): { date: string; time: string } {
  const p = localParts(new Date(iso))
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` }
}
export function todayLocal(): string {
  return toLocalParts(new Date().toISOString()).date
}
export function addMinutes(iso: string, m: number): string {
  return new Date(new Date(iso).getTime() + m * 60000).toISOString()
}
/** "YYYY-MM-DD" + n days (calendar arithmetic, no time zone involved). */
export function addDays(dateYYYYMMDD: string, n: number): string {
  const [y, m, d] = dateYYYYMMDD.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
/** Friendly day name for a local date: اليوم / غداً / weekday + day. */
export function dayLabel(dateYYYYMMDD: string): string {
  const today = todayLocal()
  if (dateYYYYMMDD === today) return 'اليوم'
  if (dateYYYYMMDD === addDays(today, 1)) return 'غداً'
  return fmtDate(fromLocal(dateYYYYMMDD, '12:00'))
}
/** "HH:MM" (24h) → "9:30 ص" without needing a date. */
export function fmtClock(timeHHMM: string): string {
  const [h, mi] = timeHHMM.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(mi)} ${h < 12 ? 'ص' : 'م'}`
}

export function statusLabel(s: BookingStatus): { text: string; tone: 'wine' | 'gold' | 'green' | 'grey' | 'red' } {
  switch (s) {
    case 'pending_payment': return { text: 'بانتظار الدفع', tone: 'gold' }
    case 'awaiting_verification': return { text: 'عم نتحقق من الدفع', tone: 'gold' }
    case 'confirmed': return { text: 'مؤكد', tone: 'green' }
    case 'rejected': return { text: 'مرفوض', tone: 'red' }
    case 'expired': return { text: 'انتهت المهلة', tone: 'grey' }
    case 'cancelled': return { text: 'ملغى', tone: 'grey' }
    case 'completed': return { text: 'منتهي', tone: 'grey' }
    default: return { text: s, tone: 'grey' }
  }
}

export function durationLabel(minutes: number): string {
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const half = minutes % 60 === 30
  const rest = minutes % 60
  if (h === 0) return half ? 'نص ساعة' : `${rest} دقيقة`
  let base: string
  if (h === 1) base = 'ساعة'
  else if (h === 2) base = 'ساعتين'
  else if (h <= 10) base = `${h} ساعات`
  else base = `${h} ساعة`
  if (half) return `${base} ونص`
  if (rest) return `${base} و${rest} دقيقة`
  return base
}

/** Accepts 09XXXXXXXX, +963 9XXXXXXXX, 00963…, with spaces/dashes and Arabic-Indic digits. Returns 09XXXXXXXX or null. */
export function normalisePhone(s: string): string | null {
  if (!s) return null
  let digits = s.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/\D/g, '')
  if (digits.startsWith('00963')) digits = '0' + digits.slice(5)
  else if (digits.startsWith('963')) digits = '0' + digits.slice(3)
  else if (digits.length === 9 && digits.startsWith('9')) digits = '0' + digits
  return /^09\d{8}$/.test(digits) ? digits : null
}
