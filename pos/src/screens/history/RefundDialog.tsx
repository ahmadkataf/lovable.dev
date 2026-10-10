// The refund sheet: a quantity per line (never more than what is left), money-back method, restock, reason.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Minus, Plus, Undo2 } from 'lucide-react'
import { db } from '../../db'
import type { PaymentMethod, Refund, Sale } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Field, Input, Modal, Seg, SwitchRow } from '../../components/ui'
import { formatMoney, formatQty, parseNumber, round } from '../../lib/money'
import { beep } from '../../lib/audio'
import { printSale } from '../../lib/receipt'
import { createRefund, refundErrorText, refundLineTotal, refundTotal, remainingQty } from '../../lib/refunds'
import { toast, useSettings, useStore, useUser } from '../../state/store'
import { currencyForCode } from '../../lib/fx'
import { methodLabel } from './shared'

function unitLabel(unit: string, t: (k: string) => string): string {
  if (!unit) return ''
  const v = t('unit.' + unit)
  return v === 'unit.' + unit ? unit : v
}

/** The method the money most likely goes back by: the account when the sale was on credit, else how it was paid. */
function defaultMethod(sale: Sale): PaymentMethod {
  if (sale.credit > 0 && sale.customerId) return 'credit'
  const first = sale.payments.find(p => p.method !== 'credit' && p.amount > 0)
  return first?.method ?? 'cash'
}

export function RefundDialog({ sale, refunds, onClose, onDone }: { sale: Sale; refunds: Refund[]; onClose: () => void; onDone: (r: Refund) => void }) {
  const t = useT()
  const settings = useSettings()
  const c = settings.currency
  const d = c.decimals
  const user = useUser()
  const shift = useStore(s => s.shift)
  // the sale's own rate: the refund returns the lira paid, and this is what that is worth in the second currency
  const c2 = typeof sale.rate === 'number' && sale.rate > 0 ? currencyForCode(sale.rateCode, settings) : null
  const remaining = useMemo(() => remainingQty(sale, refunds, d), [sale, refunds, d])
  const products = useLiveQuery(async () => {
    const ids = [...new Set(sale.items.map(i => i.productId).filter((x): x is string => !!x))]
    const rows = await db.products.bulkGet(ids)
    return new Map(rows.filter(Boolean).map(p => [p!.id, p!]))
  }, [sale.id])
  const [qty, setQty] = useState<number[]>(() => sale.items.map(() => 0))
  const [text, setText] = useState<string[]>(() => sale.items.map(() => '0'))
  const [method, setMethod] = useState<PaymentMethod>(() => defaultMethod(sale))
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (method === 'credit' && !sale.customerId) setMethod(defaultMethod(sale)) }, [method, sale])

  const allowFraction = (i: number) => { const it = sale.items[i]; const p = it.productId ? products?.get(it.productId) : undefined; return p ? p.allowFraction : !Number.isInteger(it.qty) }
  const setLine = (i: number, v: number) => {
    const max = remaining[i]
    let n = Math.max(0, Math.min(max, round(v, 3)))
    if (!allowFraction(i)) n = Math.min(max, Math.floor(n))
    setQty(q => q.map((x, k) => (k === i ? n : x)))
    setText(s => s.map((x, k) => (k === i ? formatQty(n) : x)))
  }
  const setAll = (full: boolean) => { setQty(remaining.map(r => (full ? r : 0))); setText(remaining.map(r => formatQty(full ? r : 0))) }
  const lines = qty.map((q, index) => ({ index, qty: q })).filter(l => l.qty > 0)
  const total = refundTotal(sale, lines, d)
  const anyLeft = remaining.some(r => r > 0)
  const allPicked = anyLeft && remaining.every((r, i) => r <= 0 || Math.abs(qty[i] - r) < 1e-6)

  const confirm = async () => {
    if (busy || !user || !lines.length) return
    setBusy(true)
    try {
      const r = await createRefund({ sale, items: lines, method, restock, reason, user, shift, settings })
      beep('ok')
      toast(t('history.refundDone'), 'success')
      if (settings.receipt.autoPrint) void printSale(sale, settings, { refund: r, silent: true }).catch(() => undefined)
      onDone(r)
    } catch (e) { beep('error'); toast(refundErrorText(e, t), 'error'); setBusy(false) }
  }

  const methods: { value: PaymentMethod; label: string }[] = [
    { value: 'cash', label: t('common.cash') }, { value: 'card', label: t('common.card') }, { value: 'transfer', label: t('common.transfer') },
  ]
  if (sale.customerId) methods.push({ value: 'credit', label: t('history.rf.credit') })

  return (
    <Modal open onClose={onClose} title={t('history.rf.title', { n: sale.number })} size="wide" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="danger" icon={<Undo2 size={18} />} loading={busy} disabled={!lines.length} onClick={() => void confirm()}>{t('history.rf.confirm')}</Button>
      </>
    }>
      <div className="col" style={{ gap: 14 }}>
        <div className="row between">
          <span className="label">{t('history.rf.pickItems')}</span>
          <span className="row" style={{ gap: 6 }}>
            <Button size="sm" variant="soft" onClick={() => setAll(true)} disabled={!anyLeft || allPicked}>{t('history.rf.all')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAll(false)} disabled={!lines.length}>{t('history.rf.none')}</Button>
          </span>
        </div>
        {!anyLeft ? <p className="muted small">{t('history.rf.nothingLeft')}</p> : (
          <div className="hi-rf-list">
            {sale.items.map((it, i) => {
              const left = remaining[i]
              const done = left <= 0
              return (
                <div key={i} className={`hi-rf-row ${done ? 'done' : ''}`}>
                  <div className="truncate">
                    <div className="hi-rf-name truncate">{it.name}</div>
                    <div className="hi-rf-left num">{t('history.rf.remaining', { q: `${formatQty(left)} ${unitLabel(it.unit, t)}` })} · {formatMoney(it.total, c)}</div>
                  </div>
                  <div className="hi-step" dir="ltr">
                    <button type="button" onClick={() => setLine(i, qty[i] - 1)} disabled={done || qty[i] <= 0} aria-label="-"><Minus size={18} /></button>
                    <input
                      className="input num" inputMode={allowFraction(i) ? 'decimal' : 'numeric'} value={text[i]} disabled={done}
                      onChange={e => { const raw = e.target.value; setText(s => s.map((x, k) => (k === i ? raw : x))); const n = parseNumber(raw); setQty(q => q.map((x, k) => (k === i ? Math.max(0, Math.min(left, allowFraction(i) ? round(n, 3) : Math.floor(n))) : x))) }}
                      onBlur={() => setLine(i, qty[i])}
                      onFocus={e => e.target.select()}
                    />
                    <button type="button" onClick={() => setLine(i, qty[i] + 1)} disabled={done || qty[i] >= left} aria-label="+"><Plus size={18} /></button>
                  </div>
                  <div className="hi-rf-amt num">{qty[i] > 0 ? formatMoney(refundLineTotal(sale, i, qty[i], d), c) : ''}</div>
                </div>
              )
            })}
          </div>
        )}
        <div className="hi-rf-total"><span>{t('history.rf.total')}</span><span className="num">{formatMoney(total, c)}{c2 && total > 0 ? <span className="small muted"> ≈ {formatMoney(round(total / sale.rate!, c2.decimals), c2)}</span> : null}</span></div>
        <Field label={t('history.rf.method')} hint={method === 'credit' ? t('history.rf.creditHint', { name: sale.customerName ?? '' }) : undefined}>
          <Seg block value={method} onChange={setMethod} options={methods.map(m => ({ value: m.value, label: m.value === 'credit' ? m.label : methodLabel(m.value) }))} />
        </Field>
        <div className="hi-rf-grid">
          <SwitchRow label={t('history.rf.restock')} desc={t('history.rf.restockDesc')} on={restock} onChange={setRestock} />
          <Field label={t('history.rf.reason')}>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('history.rf.reasonPh')} maxLength={120} onKeyDown={e => { if (e.key === 'Enter') void confirm() }} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
