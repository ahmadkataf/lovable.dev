// سداد للمورّد: an amount, a method, optionally out of the open drawer → paySupplier().
// When we owe the supplier dollars (fxBalance > 0) a Seg lets the payment be made in dollars: it moves `fxBalance` only
// and the drawer is debited by the lira equivalent at today's rate.
import { useEffect, useState } from 'react'
import type { PaymentMethod, Supplier } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Field, Input, Modal, Seg, SwitchRow } from '../../components/ui'
import { formatMoney, parseNumber, round } from '../../lib/money'
import { paySupplier, PurchaseError, type PurchaseRecord } from '../../lib/purchases'
import { toast, useSettings, useStore, useUser } from '../../state/store'
import { AmountPad } from './shared'

export function PaySupplierModal({ open, onClose, supplier, onPaid, preferFx }: { open: boolean; onClose: () => void; supplier: Supplier; onPaid?: (p: PurchaseRecord) => void; preferFx?: boolean }) {
  const t = useT()
  const user = useUser()
  const shift = useStore(s => s.shift)
  const settings = useSettings()
  const c = settings.currency
  const c2 = settings.currency2
  const fxBalance = supplier.fxBalance ?? 0
  const fxAvail = c2.enabled && c2.rate > 0 && fxBalance > 0
  const [inFx, setInFx] = useState(false)
  const [v, setV] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [drawer, setDrawer] = useState(true)
  const [busy, setBusy] = useState(false)
  const fx = inFx && fxAvail
  const cur = fx ? c2 : c
  const balance = fx ? fxBalance : supplier.balance
  useEffect(() => {
    if (!open) return
    // dollars first when that is what we owe (or the invoice we came from was in dollars), else the primary balance
    const startFx = fxAvail && (!!preferFx || !(supplier.balance > 0))
    setInFx(startFx)
    const b = startFx ? fxBalance : supplier.balance
    setV(b > 0 ? String(round(b, startFx ? c2.decimals : c.decimals)) : '')
    setMethod(settings.pos.defaultMethod === 'credit' ? 'cash' : settings.pos.defaultMethod)
    setNote(''); setDrawer(!!shift); setBusy(false)
  }, [open, supplier.balance, fxBalance, fxAvail, preferFx, c.decimals, c2.decimals, settings.pos.defaultMethod, shift])
  const switchFx = (to: boolean) => {
    if (to === fx) return
    setInFx(to)
    const b = to ? fxBalance : supplier.balance
    setV(b > 0 ? String(round(b, to ? c2.decimals : c.decimals)) : '')
  }
  const n = parseNumber(v)
  const after = round(balance - n, cur.decimals)
  const primaryEquiv = fx ? round(n * c2.rate, c.decimals) : n
  const confirm = async () => {
    if (!(n > 0) || busy || !user) return
    setBusy(true)
    try {
      const p = await paySupplier({
        supplierId: supplier.id, amount: n, method, note, user, decimals: c.decimals,
        drawerShiftId: drawer && method === 'cash' && shift ? shift.id : undefined,
        fx: fx ? { code: c2.code, symbol: c2.symbol, decimals: c2.decimals, symbolAfter: c2.symbolAfter, rate: c2.rate } : undefined,
      })
      toast(t('inventory.pay.saved'), 'success')
      onPaid?.(p)
      onClose()
    } catch (e) { toast(e instanceof PurchaseError ? t(e.key) : t('common.error'), 'error'); setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('inventory.pay.title')} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={!(n > 0)} loading={busy} onClick={() => void confirm()}>{t('inventory.pay.confirm')}</Button>
      </>
    }>
      <div className="col">
        <div className="bold">{supplier.name}</div>
        {fxAvail && (
          <Field label={t('inventory.pay.inFx', { cur: c2.symbol })}>
            <Seg block value={fx ? 'fx' : 'primary'} onChange={x => switchFx(x === 'fx')} options={[{ value: 'primary', label: <span className="num">{c.symbol}</span> }, { value: 'fx', label: <span className="num">{c2.symbol}</span> }]} />
          </Field>
        )}
        <div className="inv-before-after">
          <span><span className="xs faint">{t('inventory.pay.balance')}</span><b className="num">{formatMoney(balance, cur)}</b></span>
          <span className="inv-arrow">←</span>
          <span><span className="xs faint">{t('inventory.pay.after')}</span><b className={`num ${after < 0 ? 'inv-pos' : ''}`}>{formatMoney(after, cur)}</b></span>
        </div>
        {fx && <div className="small muted num center">{t('inventory.purchase.rate', { cur: c2.symbol, rate: formatMoney(c2.rate, c) })}{n > 0 ? ` · ${t('inventory.form.equiv', { v: formatMoney(primaryEquiv, c) })}` : ''}</div>}
        <AmountPad value={v} onChange={setV} decimals={cur.decimals} suffix={cur.symbol} onEnter={() => void confirm()} quick={balance > 0 ? [{ label: t('inventory.pay.full'), value: String(round(balance, cur.decimals)) }] : undefined} />
        <Seg block value={method} onChange={setMethod} options={[{ value: 'cash', label: t('common.cash') }, { value: 'card', label: t('common.card') }, { value: 'transfer', label: t('common.transfer') }]} />
        {shift && method === 'cash' && <SwitchRow label={t('inventory.form.drawer')} desc={fx ? t('inventory.form.rateNote', { main: c.code }) : t('inventory.form.drawerDesc')} on={drawer} onChange={setDrawer} />}
        <Field label={t('common.note')}><Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('inventory.pay.notePh')} /></Field>
      </div>
    </Modal>
  )
}
