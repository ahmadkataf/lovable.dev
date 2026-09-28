import { useStore } from '../db/store'

const AR_DIGITS = false // keep western digits: they are what invoices and calculators use in the shops

export function money(n: number, opts?: { decimals?: number; currency?: boolean }): string {
  const s = useStore.getState().cfg
  const d = opts?.decimals ?? s.decimals
  const v = Number.isFinite(n) ? n : 0
  const text = v.toLocaleString(AR_DIGITS ? 'ar-EG' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  return opts?.currency === false ? text : `${text} ${s.currency}`
}

export function num(n: number, decimals = 0): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

export function fmtDate(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function fmtTime(t: number): string {
  const d = new Date(t)
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'م' : 'ص'; h = h % 12 || 12
  return `${h}:${m} ${ap}`
}

export function fmtDateTime(t: number): string { return `${fmtDate(t)} ${fmtTime(t)}` }

/** yyyy-mm-dd for <input type=date>, in local time */
export function toInputDate(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function fromInputDate(s: string, keepTimeOf?: number): number {
  const [y, m, d] = s.split('-').map(Number)
  const base = keepTimeOf ? new Date(keepTimeOf) : new Date()
  return new Date(y, m - 1, d, base.getHours(), base.getMinutes(), base.getSeconds()).getTime()
}

export function startOfDay(t: number): number { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
export function endOfDay(t: number): number { const d = new Date(t); d.setHours(23, 59, 59, 999); return d.getTime() }
export function startOfMonth(t: number): number { const d = new Date(t); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime() }
export function addDays(t: number, n: number): number { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime() }

export function invoiceNo(n: number, prefix = ''): string { return `${prefix}${String(n).padStart(5, '0')}` }

export function pad(n: number): string { return String(n).padStart(2, '0') }

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']

export function toNumber(v: string | number | undefined | null): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (!v) return 0
  // accept Arabic-Indic digits and thousands separators
  const s = String(v).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,\s\u066C']/g, '').replace('٫', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Case/diacritic-insensitive search normalisation for Arabic and Latin text */
export function norm(s: string | undefined | null): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim()
}

export function matches(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = norm(query)
  if (!q) return true
  const words = q.split(/\s+/)
  const hay = fields.map(norm).join(' ')
  return words.every(w => hay.includes(w))
}
