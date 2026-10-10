import type { Clinic, Lang } from '@/db/types'

export type MoneyOpts = Pick<Clinic, 'currency' | 'currencySymbol' | 'currencyDecimals'>

const nf = new Map<string, Intl.NumberFormat>()
function numberFormat(lang: Lang, decimals: number): Intl.NumberFormat {
  const key = `${lang}:${decimals}`
  let f = nf.get(key)
  if (!f) {
    // Latin digits in both languages: clinics read and type Western numerals
    f = new Intl.NumberFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    nf.set(key, f)
  }
  return f
}

/** 1250 → "1,250.00 $" (symbol after the number in Arabic, before it in English). */
export function formatMoney(amount: number, c: MoneyOpts, lang: Lang = 'ar', opts: { sign?: boolean; compact?: boolean } = {}): string {
  const n = Number.isFinite(amount) ? amount : 0
  const abs = Math.abs(n)
  let body: string
  if (opts.compact && abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  else if (opts.compact && abs >= 10_000) body = `${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}K`
  else body = numberFormat(lang, c.currencyDecimals ?? 2).format(abs)
  const sign = n < 0 ? '-' : opts.sign && n > 0 ? '+' : ''
  const sym = c.currencySymbol || c.currency
  return lang === 'ar' ? `${sign}${body} ${sym}` : `${sign}${sym}${body}`
}

export function formatNumber(n: number, lang: Lang = 'ar', decimals = 0): string {
  return numberFormat(lang, decimals).format(Number.isFinite(n) ? n : 0)
}
export function formatPercent(n: number, lang: Lang = 'ar', decimals = 0): string {
  return `${numberFormat(lang, decimals).format(n)}%`
}

/** 0944123456 → 0944 123 456; keeps other formats as typed. */
export function formatPhone(p?: string): string {
  if (!p) return ''
  const d = p.replace(/\s+/g, '')
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  if (/^\+\d{10,13}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 10)} ${d.slice(10)}`
  return p
}
export function phoneDigits(p?: string): string { return (p || '').replace(/[^\d+]/g, '') }
export function whatsappLink(phone: string, text?: string, defaultCountry = '963'): string {
  let d = phoneDigits(phone).replace(/^\+/, '').replace(/^00/, '')
  if (d.startsWith('0')) d = defaultCountry + d.slice(1)
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Two letters for an avatar. Titles (د. / Dr.) are skipped and the Arabic article is dropped: "د. أحمد الخطيب" → "أخ". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(p => p && !/^(د\.?|دكتور|دكتورة|Dr\.?|Mr\.?|Mrs\.?|Ms\.?)$/i.test(p))
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].replace(/^ال(?=\S{2,})/, '').slice(0, 2)
  const strip = (w: string) => w.replace(/^ال(?=\S{2,})/, '')
  return (strip(parts[0])[0] + strip(parts[parts.length - 1])[0]).toUpperCase()
}

const AVATAR_COLORS = ['#0E8F86', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2', '#4F46E5', '#CA8A04', '#DC2626']
export function colorFor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100 }
export function clamp(n: number, min: number, max: number): number { return Math.min(max, Math.max(min, n)) }
export function sum<T>(list: T[], f: (x: T) => number): number { return list.reduce((a, x) => a + (f(x) || 0), 0) }

/** Human file size. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Case- and diacritic-insensitive search, Arabic-aware (ignores hamza/ta-marbuta variants and tashkeel). */
export function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim()
}
export function matches(haystack: string | undefined, needle: string): boolean {
  if (!needle) return true
  return normalizeText(haystack || '').includes(normalizeText(needle))
}
