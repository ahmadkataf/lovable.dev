// سداد للمورّد: an amount, a method, optionally out of the open drawer → paySupplier().
import { useEffect, useState } from 'react'
import type { PaymentMethod, Supplier } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Field, Input, Modal, Seg, SwitchRow } from '../../components/ui'
import { formatMoney, parseNumber, round } from '../../lib/money'
import { paySupplier, PurchaseError, type PurchaseRecord } from '../../lib/purchases'
import { toast, useSettings, useStore, useUser } from '../../state/store'
import { AmountPad } from './shared'

export function PaySupplierModal({ open, onClose, supplier, onPaid }: { open: boolean; onClose: () => void; supplier: Supplier; onPaid?: (p: PurchaseRecord) => void }) {
  const t = useT()
  const user = useUser()
  const shift = useStore(s => s.shift)
  const settings = useSettings()
  const c = settings.currency
  const [v, setV] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [drawer, setDrawer] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setV(supplier.balance > 0 ? String(round(supplier.balance, c.decimals)) : '')
    setMethod(settings.pos.defaultMethod === 'credit' ? 'cash' : settings.pos.defaultMethod)
    setNote(''); setDrawer(!!shift); setBusy(false)
  }, [open, supplier.balance, c.decimals, settings.pos.defaultMethod, shift])
  const n = parseNumber(v)
  const after = round(supplier.balance - n, c.decimals)
  const confirm = async () => {
    if (!(n > 0) || busy || !user) return
    setBusy(true)
    try {
      const p = await paySupplier({ supplierId: supplier.id, amount: n, method, note, user, decimals: c.decimals, drawerShiftId: drawer && method === 'cash' && shift ? shift.id : undefined })
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
        <div className="inv-before-after">
          <span><span className="xs faint">{t('inventory.pay.balance')}</span><b className="num">{formatMoney(supplier.balance, c)}</b></span>
          <span className="inv-arrow">←</span>
          <span><span className="xs faint">{t('inventory.pay.after')}</span><b className={`num ${after < 0 ? 'inv-pos' : ''}`}>{formatMoney(after, c)}</b></span>
        </div>
        <AmountPad value={v} onChange={setV} decimals={c.decimals} suffix={c.symbol} onEnter={() => void confirm()} quick={supplier.balance > 0 ? [{ label: t('inventory.pay.full'), value: String(round(supplier.balance, c.decimals)) }] : undefined} />
        <Seg block value={method} onChange={setMethod} options={[{ value: 'cash', label: t('common.cash') }, { value: 'card', label: t('common.card') }, { value: 'transfer', label: t('common.transfer') }]} />
        {shift && method === 'cash' && <SwitchRow label={t('inventory.form.drawer')} desc={t('inventory.form.drawerDesc')} on={drawer} onChange={setDrawer} />}
        <Field label={t('common.note')}><Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('inventory.pay.notePh')} /></Field>
      </div>
    </Modal>
  )
}
