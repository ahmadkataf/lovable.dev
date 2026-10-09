// Taking the money: method, amount received (numpad / keyboard / quick buttons), change, credit remainder.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, ArrowLeftRight, BookUser, User, Check, Info, TriangleAlert } from 'lucide-react'
import type { Customer, PaymentMethod, Settings } from '../../db/types'
import type { Cart, Totals } from '../../lib/cart'
import { formatMoney, parseNumber, quickAmounts, round } from '../../lib/money'
import { planPayment, type PaymentPlan } from '../../lib/sales'
import { useT } from '../../i18n'
import { Modal, Button, NumPad, useIsMobile } from '../../components/ui'
import { mergeQuickAmounts } from './search'
import { useNumKeys } from './dialogs'

export interface PaymentModalProps {
  cart: Cart
  totals: Totals
  settings: Settings
  customer?: Customer
  busy: boolean
  /** Another dialog (the customer picker) sits on top: keep Esc / backdrop from closing this one. */
  frozen?: boolean
  onPickCustomer: () => void
  onConfirm: (plan: PaymentPlan) => void
  onClose: () => void
}

export function PaymentModal(p: PaymentModalProps) {
  const t = useT()
  const isMobile = useIsMobile()
  const { settings, totals, cart, customer } = p
  const c = settings.currency
  const d = c.decimals
  const total = totals.total
  const hasCustomer = !!cart.customerId
  const [method, setMethod] = useState<PaymentMethod>(() => (settings.pos.defaultMethod === 'credit' && !hasCustomer ? 'cash' : settings.pos.defaultMethod))
  const [tendered, setTendered] = useState('')
  useEffect(() => { if (method === 'credit' && !hasCustomer) setMethod('cash') }, [hasCustomer, method])

  const typed = tendered !== ''
  const received = typed ? parseNumber(tendered) : total
  const plan = useMemo(() => planPayment({ total, method, tendered: received, hasCustomer, decimals: d }), [total, method, received, hasCustomer, d])
  const quick = useMemo(() => mergeQuickAmounts(quickAmounts(total, d), settings.pos.quickAmounts, total), [total, d, settings.pos.quickAmounts])
  const balanceAfter = customer ? round(customer.balance + plan.credit, d) : undefined
  const confirm = useCallback(() => { if (plan.valid && !p.busy) p.onConfirm(plan) }, [plan, p])
  useNumKeys({ enabled: !p.frozen && method !== 'credit', value: tendered, onChange: setTendered, decimals: d, onEnter: confirm })
  useEffect(() => {
    if (p.frozen || method !== 'credit') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const el = document.activeElement as HTMLElement | null
      if (el && el.closest('.modal') && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      e.preventDefault(); confirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [p.frozen, method, confirm])

  const methods: { value: PaymentMethod; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { value: 'cash', label: t('common.cash'), icon: <Banknote size={20} /> },
    { value: 'card', label: t('common.card'), icon: <CreditCard size={20} /> },
    { value: 'transfer', label: t('common.transfer'), icon: <ArrowLeftRight size={20} /> },
    { value: 'credit', label: t('common.credit'), icon: <BookUser size={20} />, disabled: !hasCustomer },
  ]
  const reasonText = plan.reason ? t(plan.reason) : ''

  const summary = (
    <div className="pay-summary">
      <div className="tot-row"><span className="lbl">{t('common.total')}</span><span className="num">{formatMoney(total, c)}</span></div>
      {method !== 'credit' && <div className="tot-row"><span className="lbl">{t('common.paid')}</span><span className="num">{formatMoney(plan.paid, c)}</span></div>}
      {plan.change > 0 && <div className="tot-row change"><span className="lbl">{t('sales.payChange')}</span><span className="num">{formatMoney(plan.change, c)}</span></div>}
      {plan.short > 0 && <div className="tot-row short"><span className="lbl">{t('common.remaining')}</span><span className="num">{formatMoney(plan.short, c)}</span></div>}
      {plan.credit > 0 && <div className="tot-row"><span className="lbl">{t('receipt.onAccount')}</span><span className="num">{formatMoney(plan.credit, c)}</span></div>}
      {plan.credit > 0 && balanceAfter !== undefined && <div className="tot-row"><span className="lbl">{t('sales.payBalanceAfter')}</span><span className="num bold">{formatMoney(balanceAfter, c)}</span></div>}
      {!plan.valid && reasonText && <div className="note danger"><TriangleAlert size={14} style={{ flex: 'none', marginTop: 2 }} />{reasonText}</div>}
      {plan.valid && plan.credit > 0 && method !== 'credit' && <div className="note ok"><Info size={14} style={{ flex: 'none', marginTop: 2 }} />{t('sales.payRemainderCredit', { amount: formatMoney(plan.credit, c) })}</div>}
      {method === 'credit' && plan.valid && <div className="note ok"><Info size={14} style={{ flex: 'none', marginTop: 2 }} />{t('sales.payAllCredit')}</div>}
    </div>
  )

  const customerRow = (
    <div className="pay-customer">
      <User size={16} />
      <span className="truncate grow">{customer ? customer.name : cart.customerName || t('sales.customerNone')}</span>
      {customer && <span className="num small muted">{customer.balance > 0 ? t('sales.customerOwes', { amount: formatMoney(customer.balance, c) }) : customer.balance < 0 ? t('sales.customerHas', { amount: formatMoney(-customer.balance, c) }) : t('sales.customerClear')}</span>}
      <Button size="sm" variant="soft" onClick={p.onPickCustomer}>{customer ? t('common.edit') : t('sales.customerPick')}</Button>
    </div>
  )

  const amountPane = method === 'credit' ? null : (
    <>
      <div className={`pay-tendered ${typed ? 'editing' : ''}`} onClick={() => setTendered('')} role="textbox" aria-label={t('sales.payTendered')}>
        <span className="lbl">{t('sales.payTendered')}</span>
        {typed ? <>{tendered}<span className="caret" /></> : <span>{formatMoney(total, c, { symbol: false })}</span>}
      </div>
      <div className="pay-quick">
        <Button size="sm" variant={!typed ? 'soft' : 'default'} onClick={() => setTendered('')}>{t('sales.payExact')}</Button>
        {quick.filter(n => n !== total).map(n => <Button key={n} size="sm" variant={typed && parseNumber(tendered) === n ? 'soft' : 'default'} onClick={() => setTendered(String(n))}><span className="num">{formatMoney(n, c, { symbol: false })}</span></Button>)}
      </div>
      <NumPad value={tendered} onChange={setTendered} decimals={d} />
    </>
  )

  return (
    <Modal open onClose={p.onClose} title={t('sales.payTitle')} size={isMobile ? 'normal' : 'wide'} noClose={p.frozen} footer={
      <>
        <Button onClick={p.onClose} disabled={p.busy}>{t('common.cancel')}</Button>
        <Button variant="primary" size="lg" icon={<Check size={18} />} loading={p.busy} disabled={!plan.valid || p.busy} onClick={confirm}>
          {t('sales.payConfirm')}{plan.valid && method !== 'credit' && plan.change > 0 ? <span className="num"> · {formatMoney(plan.change, c)}</span> : null}
        </Button>
      </>
    }>
      <div className="pay-due"><span className="lbl">{t('sales.payDue')}</span><span className="amt num">{formatMoney(total, c)}</span></div>
      <div className="pay-methods" role="tablist" aria-label={t('sales.payMethod')}>
        {methods.map(m => (
          <button key={m.value} type="button" role="tab" aria-selected={method === m.value} className={method === m.value ? 'on' : ''} disabled={m.disabled} title={m.disabled ? t('sales.payCreditNeedsCustomer') : undefined} onClick={() => { setMethod(m.value); if (m.value !== 'cash') setTendered('') }}>
            {m.icon}<span>{m.label}</span>
          </button>
        ))}
      </div>
      {method === 'credit' ? (
        <div className="col" style={{ gap: 10 }}>{customerRow}{summary}</div>
      ) : isMobile ? (
        <div className="col" style={{ gap: 10 }}>{amountPane}{summary}{customerRow}</div>
      ) : (
        <div className="pay-grid">
          <div className="pay-left">{amountPane}</div>
          <div className="pay-right">{summary}{customerRow}</div>
        </div>
      )}
    </Modal>
  )
}
