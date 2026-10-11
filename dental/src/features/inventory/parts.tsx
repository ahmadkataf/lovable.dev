// Small shared pieces of the inventory screens: labels and status badges.
import { CalendarClock, CalendarX2, Flag, Minus, PackageX, ShoppingCart, SlidersHorizontal, TriangleAlert, Trash2, Undo2 } from 'lucide-react'
import type { ISODate, InventoryItem, StockReason } from '@/db/types'
import { Badge, type Tone } from '@/ui'
import { useI18n } from '@/i18n'
import { fmtDate } from '@/lib/dates'
import { formatMoney, formatNumber } from '@/lib/format'
import { useClinic } from '@/app/hooks'
import { tn } from './plural'
import { CATEGORY_PRESETS, UNITS, daysToExpiry, expiryState, isLowStock, isOutOfStock, isPresetCategory, unitPriceDecimals } from './lib'

type T = (k: string, p?: Record<string, string | number>) => string

export const catLabel = (t: T, c: string) => (isPresetCategory(c) ? t(`inventory.cat.${c}`) : c)
export const unitLabel = (t: T, u: string) => ((UNITS as readonly string[]).includes(u) ? t(`inventory.unit.${u}`) : u)
export const reasonLabel = (t: T, r: StockReason) => t(`inventory.reason.${r}`)

/** Every label a preset may be typed as, in both languages (for the category box). */
export function presetLabels(tAr: T, tEn: T): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const k of CATEGORY_PRESETS) out[k] = [tAr(`inventory.cat.${k}`), tEn(`inventory.cat.${k}`)]
  return out
}

/** Unit prices keep their cents even when the clinic shows whole amounts (0.25 $ must not read 0 $). */
export function useUnitMoney() {
  const c = useClinic(); const { lang } = useI18n()
  return (n: number) => formatMoney(n, { ...c, currencyDecimals: unitPriceDecimals(n, c.currencyDecimals ?? 2) }, lang)
}

/** Quantities print without trailing zeros (12, 2.5). */
export function qtyText(n: number, lang: 'ar' | 'en'): string {
  return formatNumber(n, lang, Number.isInteger(n) ? 0 : 2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

const REASON_TONE: Record<StockReason, Tone> = { purchase: 'success', use: 'info', adjust: 'purple', expired: 'danger', return: 'orange', initial: 'default' }
const REASON_ICON: Record<StockReason, typeof Minus> = { purchase: ShoppingCart, use: Minus, adjust: SlidersHorizontal, expired: Trash2, return: Undo2, initial: Flag }
export function ReasonBadge({ reason }: { reason: StockReason }) {
  const { t } = useI18n()
  const I = REASON_ICON[reason] ?? SlidersHorizontal
  return <Badge tone={REASON_TONE[reason] ?? 'default'} icon={<I />}>{reasonLabel(t, reason)}</Badge>
}

export function CategoryBadge({ category }: { category: string }) {
  const { t } = useI18n()
  if (!category) return null
  const label = catLabel(t, category)
  // custom categories are free text: keep a long one from widening the row
  return <Badge tone={isPresetCategory(category) ? 'primary' : 'outline'} size="sm" className="inv-cat-badge"><span className="truncate" dir="auto" title={label}>{label}</span></Badge>
}

/** Expired / expires soon badge; nothing for far or missing dates unless `always`. */
export function ExpiryBadge({ date, today, always }: { date?: ISODate; today: ISODate; always?: boolean }) {
  const { t, lang } = useI18n()
  const s = expiryState(date, today)
  if (s === 'none') return always ? <span className="muted">—</span> : null
  const days = daysToExpiry(date, today) ?? 0
  if (s === 'expired') return <Badge tone="danger" icon={<CalendarX2 />}>{t('inventory.expired')}</Badge>
  if (s === 'soon') return <Badge tone="warning" icon={<CalendarClock />}>{days === 0 ? t('inventory.expiresToday') : tn(t, lang, 'inventory.expiresIn', days)}</Badge>
  return always ? <span className="muted inv-nowrap">{fmtDate(date!, lang)}</span> : null
}

/** Out of stock / low stock badge. */
export function StockBadge({ item }: { item: Pick<InventoryItem, 'quantity' | 'minQuantity'> }) {
  const { t } = useI18n()
  if (isOutOfStock(item)) return <Badge tone="danger" icon={<PackageX />}>{t('inventory.outOfStock')}</Badge>
  if (isLowStock(item)) return <Badge tone="warning" icon={<TriangleAlert />}>{t('inventory.low')}</Badge>
  return null
}
