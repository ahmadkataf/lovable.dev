// Small pieces both history pages use: the payment-method icon, the status badge, the method word.
import { Banknote, CreditCard, ArrowLeftRight, Wallet, type LucideIcon } from 'lucide-react'
import type { PaymentMethod, Sale } from '../../db/types'
import { t } from '../../i18n'
import { Badge } from '../../components/ui'

export const METHOD_ICON: Record<PaymentMethod, LucideIcon> = { cash: Banknote, card: CreditCard, transfer: ArrowLeftRight, credit: Wallet }

export function methodLabel(m: PaymentMethod): string {
  return t(m === 'cash' ? 'common.cash' : m === 'card' ? 'common.card' : m === 'transfer' ? 'common.transfer' : 'common.credit')
}

export function MethodIcon({ method, size = 16 }: { method: PaymentMethod; size?: number }) {
  const Icon = METHOD_ICON[method]
  return <Icon size={size} aria-label={methodLabel(method)} />
}

export function statusLabel(s: Sale): string {
  return s.status === 'refunded' ? t('history.badge.refunded') : s.status === 'partial' ? t('history.badge.partial') : t('history.status.completed')
}

export function StatusBadge({ sale }: { sale: Sale }) {
  if (sale.status === 'completed') return null
  return <Badge kind={sale.status === 'refunded' ? 'danger' : 'warn'}>{statusLabel(sale)}</Badge>
}
