// The cart: lines with quantity controls, the sale tools, the totals and the big Charge button.
import { useEffect } from 'react'
import { Minus, Plus, Trash, User, Percent, StickyNote, Pause, CirclePause, Banknote, ShoppingCart, TriangleAlert, X, Clock } from 'lucide-react'
import type { Settings } from '../../db/types'
import type { Cart, CartLine, Totals } from '../../lib/cart'
import { lineTotal } from '../../lib/cart'
import { useT } from '../../i18n'
import { Button, Badge, Money } from '../../components/ui'
import { formatMoney, formatQty } from '../../lib/money'

export interface CartPanelProps {
  cart: Cart
  totals: Totals
  settings: Settings
  flash: { key: string; seq: number } | null
  onEditLine: (key: string) => void
  onQty: (key: string, qty: number) => void
  onFraction: (key: string) => void
  onCustomer: () => void
  onRemoveCustomer: () => void
  onDiscount: () => void
  onNote: () => void
  onHold: () => void
  onHeld: () => void
  heldCount: number
  onClear: () => void
  onCharge: () => void
  showKbd: boolean
  inSheet?: boolean
  noShift?: boolean
  onOpenShift?: () => void
}

export function unitLabel(unit: string, t: (k: string) => string): string {
  const key = `unit.${unit}`
  const s = t(key)
  return s === key ? unit : s
}

/** The head buttons (also used by the phone sheet's header). */
export function CartHeadActions({ heldCount, hasLines, onHeld, onHold, onClear, showKbd }: { heldCount: number; hasLines: boolean; onHeld: () => void; onHold: () => void; onClear: () => void; showKbd: boolean }) {
  const t = useT()
  return (
    <>
      {heldCount > 0 && <Button size="sm" variant="soft" icon={<CirclePause size={16} />} onClick={onHeld}>{t('sales.heldCount', { n: heldCount })}</Button>}
      {heldCount === 0 && <Button size="sm" variant="ghost" iconOnly icon={<CirclePause size={18} />} title={t('sales.heldTitle')} aria-label={t('sales.heldTitle')} onClick={onHeld} />}
      <Button size="sm" variant="ghost" iconOnly icon={<Pause size={18} />} title={showKbd ? `${t('sales.hold')} (F4)` : t('sales.hold')} aria-label={t('sales.hold')} onClick={onHold} disabled={!hasLines} />
      <Button size="sm" variant="ghost" iconOnly icon={<Trash size={18} />} title={t('sales.clear')} aria-label={t('sales.clear')} onClick={onClear} disabled={!hasLines} />
    </>
  )
}

export function CartPanel(p: CartPanelProps) {
  const t = useT()
  const { cart, totals, settings } = p
  const c = settings.currency
  const hasLines = cart.lines.length > 0

  useEffect(() => {
    if (!p.flash) return
    const el = document.getElementById(`cl-${p.flash.key}`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [p.flash])

  return (
    <aside className={`sales-cart ${p.inSheet ? 'in-sheet' : ''}`}>
      {!p.inSheet && (
        <div className="cart-head">
          <h2><ShoppingCart size={18} /> {t('sales.cart')} {hasLines && <span className="count num">{t('sales.items', { n: formatQty(totals.itemCount) })}</span>}</h2>
          <span className="spacer" />
          <CartHeadActions heldCount={p.heldCount} hasLines={hasLines} onHeld={p.onHeld} onHold={p.onHold} onClear={p.onClear} showKbd={p.showKbd} />
        </div>
      )}
      {p.noShift && p.onOpenShift && !p.inSheet && (
        <div className="row" style={{ padding: '8px 12px 0' }}>
          <Badge kind="warn" className="shift-hint"><Clock size={12} /> {t('sales.noShift')} · <a href="#/shifts" onClick={e => { e.preventDefault(); p.onOpenShift?.() }}>{t('sales.openShift')}</a></Badge>
        </div>
      )}
      <div className="cart-lines">
        {!hasLines ? (
          <div className="cart-empty">
            <div className="empty" style={{ padding: 24 }}>
              <div className="ico"><ShoppingCart size={30} /></div>
              <h3>{t('sales.cartEmpty')}</h3>
              <p>{t('sales.cartEmptyHint')}</p>
            </div>
          </div>
        ) : cart.lines.map(l => (
          <Line key={p.flash?.key === l.key ? `${l.key}:${p.flash.seq}` : l.key} l={l} settings={settings} flash={p.flash?.key === l.key} onEdit={() => p.onEditLine(l.key)} onQty={q => p.onQty(l.key, q)} onFraction={() => p.onFraction(l.key)} />
        ))}
      </div>

      <div className="cart-tools">
        <button type="button" className={`chip ${cart.customerId ? 'on' : ''}`} onClick={p.onCustomer}>
          <User size={15} />
          <span className="truncate" style={{ maxWidth: 140 }}>{cart.customerName || t('common.customer')}</span>
          {cart.customerId && <span className="x" role="button" aria-label={t('sales.customerRemove')} onClick={e => { e.stopPropagation(); p.onRemoveCustomer() }}><X size={14} /></span>}
        </button>
        <button type="button" className={`chip ${totals.discount > 0 ? 'on' : ''}`} onClick={p.onDiscount} disabled={!hasLines}>
          <Percent size={15} />
          {totals.discount > 0 ? <span className="num">{cart.discountPct !== undefined ? `${formatQty(cart.discountPct)}%` : formatMoney(totals.discount, c)}</span> : t('common.discount')}
        </button>
        <button type="button" className={`chip ${cart.note ? 'on' : ''}`} onClick={p.onNote}>
          <StickyNote size={15} /> {t('common.note')}
        </button>
      </div>

      <div className="cart-totals">
        <div className="tot-row"><span className="lbl">{t('common.subtotal')}</span><Money value={totals.subtotal} /></div>
        {totals.discount > 0 && <div className="tot-row disc"><span className="lbl">{t('common.discount')}</span><Money value={-totals.discount} /></div>}
        {settings.tax.enabled && (
          <div className="tot-row">
            <span className="lbl">{settings.tax.label || t('common.tax')} <span className="xs">{settings.tax.inclusive ? `(${t('sales.taxInclusive')})` : `${formatQty(settings.tax.rate)}%`}</span></span>
            <Money value={totals.tax} />
          </div>
        )}
        <div className="tot-row total"><span className="lbl">{t('common.total')}</span><Money value={totals.total} /></div>
      </div>

      <div className="cart-charge">
        <Button variant="primary" size="xl" block disabled={!hasLines} onClick={p.onCharge}>
          <span className="lbl"><Banknote size={22} /> {t('sales.charge')} {p.showKbd && <span className="kbd">F2</span>}</span>
          <span className="amt num">{formatMoney(totals.total, c)}</span>
        </Button>
        {p.showKbd && !p.inSheet && <div className="cart-kbd-hint">{t('sales.kbdHint')}</div>}
      </div>
    </aside>
  )
}

function Line({ l, settings, flash, onEdit, onQty, onFraction }: { l: CartLine; settings: Settings; flash: boolean; onEdit: () => void; onQty: (q: number) => void; onFraction: () => void }) {
  const t = useT()
  const c = settings.currency
  const overridden = l.price !== l.originalPrice
  const overStock = l.trackStock && l.qty > l.stock
  const unit = l.unit && l.unit !== 'piece' ? unitLabel(l.unit, t) : ''
  return (
    <div className={`cart-line ${flash ? 'flash' : ''}`} id={`cl-${l.key}`}>
      <button type="button" className="cl-info" onClick={onEdit} title={t('common.edit')}>
        <div className="cl-name">{l.name}</div>
        <div className="cl-sub">
          <span className="num">{formatMoney(l.price, c)}{unit ? ` / ${unit}` : ''}</span>
          {overridden && <span className="strike num">{formatMoney(l.originalPrice, c)}</span>}
          {l.discount > 0 && <span className="disc num">-{formatMoney(l.discount, c)}</span>}
          {l.note && <span className="truncate" style={{ maxWidth: 120 }}>· {l.note}</span>}
          {overStock && <span className="warn"><TriangleAlert size={12} /> {t('sales.lineStockWarn')} <span className="num">{formatQty(l.stock)}</span></span>}
        </div>
      </button>
      <div className="cl-qty">
        <button type="button" className={`minus ${l.qty <= 1 ? 'danger' : ''}`} onClick={() => onQty(l.qty <= 1 ? 0 : l.qty - 1)} aria-label={l.qty <= 1 ? t('common.delete') : '−'}>
          {l.qty <= 1 ? <Trash size={15} /> : <Minus size={16} />}
        </button>
        {l.allowFraction
          ? <button type="button" className="q num tap" onClick={onFraction} title={t('common.qty')}>{formatQty(l.qty)}</button>
          : <span className="q num">{formatQty(l.qty)}</span>}
        <button type="button" className="plus" onClick={() => onQty(l.qty + 1)} aria-label="+"><Plus size={16} /></button>
      </div>
      <div className="cl-total num">{formatMoney(lineTotal(l, c.decimals), c)}</div>
    </div>
  )
}
