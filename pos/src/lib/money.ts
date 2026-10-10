import type { CurrencySettings } from '../db/types'

/** Rounds to the currency's decimals, avoiding 1.005 -> 1.00 float traps. */
export function round(n: number, decimals = 2): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** decimals
  return Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f
}

const ARABIC_DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' }
/** Reads a number the way people type it: Arabic digits, commas, spaces, a trailing currency. */
export function parseNumber(s: string | number | null | undefined): number {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0
  if (!s) return 0
  let t = String(s).replace(/[٠-٩۰-۹]/g, ch => ARABIC_DIGITS[ch] ?? ch).replace(/[٫]/g, '.').replace(/[،,\s]/g, '').replace(/[^0-9.\-]/g, '')
  const neg = t.startsWith('-')
  t = t.replace(/-/g, '')
  const n = parseFloat(t)
  if (!Number.isFinite(n)) return 0
  return neg ? -n : n
}

export function formatNumber(n: number, decimals = 0, opts: { trim?: boolean } = {}): string {
  if (!Number.isFinite(n)) n = 0
  const r = round(n, decimals)
  const s = r.toLocaleString('en-US', { minimumFractionDigits: opts.trim ? 0 : decimals, maximumFractionDigits: decimals })
  return s
}

/** 1250 -> "1,250 ل.س" / "$12.50". Always left-to-right digits. */
export function formatMoney(n: number, c: CurrencySettings, opts: { sign?: boolean; symbol?: boolean } = {}): string {
  const showSymbol = opts.symbol !== false
  const abs = formatNumber(Math.abs(n), c.decimals)
  const sign = n < 0 ? '-' : opts.sign && n > 0 ? '+' : ''
  if (!showSymbol) return sign + abs
  return c.symbolAfter ? `${sign}${abs} ${c.symbol}` : `${sign}${c.symbol}${abs}`
}

/**
 * Rounds a selling price to a step (100 → 129,870 becomes 129,900). `step <= 0` means plain rounding to `decimals`.
 * Shrink guard: a step bigger than a quarter of the price shrinks tenfold until it fits, so 650 at step 500 rounds at
 * step 10 (→ 650) and a positive price never becomes 0 or moves by more than about 25 %.
 */
export function roundToStep(n: number, step: number, mode: 'nearest' | 'up', decimals: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  if (!(step > 0)) return round(n, decimals)
  const floor = 10 ** -decimals
  let s = step
  while (s > floor && n < 4 * s) s /= 10
  if (s <= floor) return round(n, decimals)
  const r = mode === 'up' ? Math.ceil(n / s - 1e-9) * s : Math.round(n / s) * s
  return round(r, decimals)
}

/** Primary units → second currency (rate = primary per 1 secondary). 0 when there is no rate. */
export function toSecondary(primary: number, rate: number, decimals2: number): number {
  if (!(rate > 0)) return 0
  return round(primary / rate, decimals2)
}
/** Second currency → primary units. */
export function toPrimary(secondary: number, rate: number, decimals1: number): number {
  if (!(rate > 0)) return 0
  return round(secondary * rate, decimals1)
}
/** Round "cash" amounts in the second currency to pay a total: the exact figure plus round notes above it. */
export function secondaryQuickAmounts(total: number, rate: number, decimals2: number): number[] {
  if (!(rate > 0) || total <= 0) return []
  const exact = round(Math.ceil((total / rate) * 10 ** decimals2) / 10 ** decimals2, decimals2)
  const out = new Set<number>([exact])
  for (const n of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) { if (n > exact) out.add(n); if (out.size >= 4) break }
  return [...out].slice(0, 4)
}

/** A quantity: 1 -> "1", 0.25 -> "0.25", 1.5 -> "1.5". */
export function formatQty(q: number): string {
  if (!Number.isFinite(q)) return '0'
  return Number.isInteger(q) ? String(q) : String(round(q, 3))
}

/** Sensible "quick cash" buttons for a total: e.g. 1250 -> [1250, 1500, 2000, 5000]. */
export function quickAmounts(total: number, decimals: number): number[] {
  if (total <= 0) return []
  const out = new Set<number>([round(total, decimals)])
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(total)) - 1)
  const steps = [1, 2, 5, 10, 20, 50]
  for (const s of steps) {
    const v = Math.ceil(total / (s * mag)) * (s * mag)
    if (v > total) out.add(round(v, decimals))
    if (out.size >= 4) break
  }
  return [...out].slice(0, 4)
}
