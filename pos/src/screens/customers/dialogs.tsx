// The money sheets on a customer's account: take a payment (any cashier) and adjust the balance (admin).
import { useState } from 'react'
import { Banknote, CreditCard, ArrowLeftRight, Printer } from 'lucide-react'
import type { Customer, LedgerEntry, PaymentMethod } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Field, Input, Modal, Seg, SwitchRow } from '../../components/ui'
import { applyLedger } from '../../lib/ledger'
import { formatMoney, parseNumber, round } from '../../lib/money'
import { beep } from '../../lib/audio'
import { platform } from '../../lib/platform'
import { balanceKind, voucherHtml } from '../../lib/customers'
import { toast, useSettings, useStore, useUser } from '../../state/store'
import { AmountPad } from '../inventory/shared'

type PayMethod = Exclude<PaymentMethod, 'credit'>

export function PaymentDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const t = useT()
  const user = useUser()
  const shift = useStore(s => s.shift)
  const settings = useSettings()
  const c = settings.currency
  const [v, setV] = useState('')
  const [method, setMethod] = useState<PayMethod>('cash')
  const [note, setNote] = useState('')
  const [print, setPrint] = useState(false)
  const [busy, setBusy] = useState(false)
  const n = round(parseNumber(v), c.decimals)
  const after = round(customer.balance - n, c.decimals)
  const over = n > 0 && customer.balance > 0 && n > customer.balance
  const full = customer.balance > 0 ? round(customer.balance, c.decimals) : 0

  const confirm = async () => {
    if (busy || !user) return
    if (!(n > 0)) { toast(t('customers.pay.errAmount'), 'error'); return }
    setBusy(true)
    try {
      const at = Date.now()
      const balanceAfter = await applyLedger({ customerId: customer.id, type: 'payment', amount: -n, method, note: note.trim() || undefined, userId: user.id, shiftId: shift?.id }, c.decimals, at)
      beep('ok')
      toast(t('customers.pay.done'), 'success')
      if (print) {
        const entry: LedgerEntry = { id: '', customerId: customer.id, type: 'payment', amount: -n, balanceAfter, note: note.trim() || undefined, method, createdAt: at, userId: user.id, shiftId: shift?.id }
        void platform.print(voucherHtml({ customer, entry, settings, userName: user.name })).catch(() => undefined)
      }
      onClose()
    } catch { toast(t('common.error'), 'error'); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('customers.pay.title')} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" loading={busy} disabled={!(n > 0)} onClick={() => void confirm()}>{t('customers.pay.confirm')}</Button>
      </>
    }>
      <div className="cu-pay">
        <AmountPad value={v} onChange={setV} decimals={c.decimals} suffix={c.symbol} onEnter={() => void confirm()}
          quick={full > 0 ? [{ label: `${t('customers.pay.full')} · ${formatMoney(full, c)}`, value: String(full) }] : undefined} />
        <div className="col">
          <Field label={t('customers.pay.method')}>
            <Seg block value={method} onChange={setMethod} options={[
              { value: 'cash', label: <span className="row" style={{ gap: 4 }}><Banknote size={14} /> {t('common.cash')}</span> },
              { value: 'card', label: <span className="row" style={{ gap: 4 }}><CreditCard size={14} /> {t('common.card')}</span> },
              { value: 'transfer', label: <span className="row" style={{ gap: 4 }}><ArrowLeftRight size={14} /> {t('common.transfer')}</span> },
            ]} />
          </Field>
          <Field label={t('common.note')}><Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('customers.pay.notePh')} maxLength={120} onKeyDown={e => { if (e.key === 'Enter') void confirm() }} /></Field>
          <div className="cu-after-box"><span>{t('customers.pay.after')}</span><span className={`num ${balanceKind(after)}`}>{formatMoney(Math.abs(after), c)} {after !== 0 && <span className="xs">{t(`customers.balance.${balanceKind(after)}`)}</span>}</span></div>
          {over && <div className="cu-warn">{t('customers.pay.over')}</div>}
          {!shift && method === 'cash' && <div className="cu-warn">{t('customers.pay.noShift')}</div>}
          <SwitchRow label={<span className="row" style={{ gap: 6 }}><Printer size={16} /> {t('customers.pay.print')}</span>} on={print} onChange={setPrint} />
        </div>
      </div>
    </Modal>
  )
}

export function AdjustDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const t = useT()
  const user = useUser()
  const settings = useSettings()
  const c = settings.currency
  const [dir, setDir] = useState<'inc' | 'dec'>('inc')
  const [v, setV] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const n = round(parseNumber(v), c.decimals)
  const delta = dir === 'inc' ? n : -n
  const after = round(customer.balance + delta, c.decimals)

  const confirm = async () => {
    if (busy || !user) return
    if (!(n > 0)) { toast(t('customers.adjust.errAmount'), 'error'); return }
    if (!reason.trim()) { toast(t('customers.adjust.errReason'), 'error'); return }
    setBusy(true)
    try {
      await applyLedger({ customerId: customer.id, type: 'adjust', amount: delta, note: reason.trim(), userId: user.id }, c.decimals)
      beep('ok')
      toast(t('customers.adjust.done'), 'success')
      onClose()
    } catch { toast(t('common.error'), 'error'); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('customers.adjust.title')} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" loading={busy} disabled={!(n > 0) || !reason.trim()} onClick={() => void confirm()}>{t('customers.adjust.confirm')}</Button>
      </>
    }>
      <div className="cu-pay">
        <AmountPad value={v} onChange={setV} decimals={c.decimals} suffix={c.symbol} onEnter={() => void confirm()} />
        <div className="col">
          <Seg block value={dir} onChange={setDir} options={[{ value: 'inc', label: t('customers.adjust.increase') }, { value: 'dec', label: t('customers.adjust.decrease') }]} />
          <Field label={t('customers.adjust.reason')}><Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('customers.adjust.reasonPh')} maxLength={120} onKeyDown={e => { if (e.key === 'Enter') void confirm() }} /></Field>
          <div className="cu-after-box"><span>{t('customers.adjust.after')}</span><span className={`num ${balanceKind(after)}`}>{formatMoney(Math.abs(after), c)} {after !== 0 && <span className="xs">{t(`customers.balance.${balanceKind(after)}`)}</span>}</span></div>
        </div>
      </div>
    </Modal>
  )
}
