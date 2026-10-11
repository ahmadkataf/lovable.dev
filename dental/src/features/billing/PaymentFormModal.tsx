// Record a payment (or a refund) for a patient: pick the patient, see their account, choose an open invoice or
// "on account", and save. Money above the invoice balance is kept as credit on the account.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Info, Printer, Wallet } from 'lucide-react'
import { db, logActivity } from '@/db'
import { todayISO } from '@/db/ids'
import { PAYMENT_METHODS, type Invoice, type PaymentMethod } from '@/db/types'
import { useI18n } from '@/i18n'
import { useClinic, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { fmtDate } from '@/lib/dates'
import { round2 } from '@/lib/format'
import { Alert, Button, Field, Input, Modal, NumberInput, Select, Skeleton, Switch, Textarea, useToast } from '@/ui'
import { recordPayment } from './actions'
import { accountFrom, invoiceBalance, isOpen, splitPayment } from './lib'
import { Money, PatientPicker, ltr, iso } from './shared'
import { openReceipt } from './Receipt'
import './billing.css'

/** Record a payment for a patient, optionally against one invoice. */
export interface PaymentFormModalProps { open: boolean; onClose: () => void; patientId?: string; invoiceId?: string; onSaved?: (id: string) => void }

export default function PaymentFormModal({ open, onClose, patientId, invoiceId, onSaved }: PaymentFormModalProps) {
  if (!open) return null
  return <PaymentForm onClose={onClose} patientId={patientId} invoiceId={invoiceId} onSaved={onSaved} />
}

const ON_ACCOUNT = ''

function PaymentForm({ onClose, patientId: givenPatient, invoiceId, onSaved }: Omit<PaymentFormModalProps, 'open'>) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const clinic = useClinic()
  const session = useSession()
  const license = useLicense()
  const toast = useToast()

  const [patientId, setPatientId] = useState(givenPatient ?? '')
  const [target, setTarget] = useState<string | null>(null)    // null = not decided yet (picked when the account loads)
  const [amount, setAmount] = useState<number | null>(null)
  const [refund, setRefund] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [date, setDate] = useState(todayISO())
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)          // Enter pressed twice / double click must not record the payment twice
  const amountRef = useRef<HTMLDivElement>(null)

  const data = useLiveQuery(async () => {
    if (!patientId) return null
    const [patient, invoices, payments] = await Promise.all([
      db.patients.get(patientId),
      db.invoices.where('patientId').equals(patientId).toArray(),
      db.payments.where('patientId').equals(patientId).toArray(),
    ])
    return { pid: patientId, patient, invoices, account: accountFrom(invoices, payments) }
  }, [patientId])
  const ready = !!data && data.pid === patientId

  const openInvoices = useMemo(() => {
    const list = (data?.invoices ?? []).filter(i => isOpen(i) || i.id === invoiceId).filter(i => i.status !== 'draft' && i.status !== 'cancelled')
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  }, [data, invoiceId])
  const selected: Invoice | undefined = target ? openInvoices.find(i => i.id === target) : undefined

  // first load of an account: preselect the given invoice, else the oldest open one, and fill the amount with its balance
  const init = useRef(false)
  useEffect(() => {
    if (!ready || init.current) return
    init.current = true
    const pre = (invoiceId ? openInvoices.find(i => i.id === invoiceId) : undefined) ?? openInvoices[0]
    setTarget(pre ? pre.id : ON_ACCOUNT)
    if (pre) setAmount(invoiceBalance(pre))
  }, [ready, openInvoices, invoiceId])

  const choose = (id: string) => {
    setTarget(id)
    const inv = openInvoices.find(i => i.id === id)
    if (inv && !refund) setAmount(invoiceBalance(inv))
    setTimeout(() => amountRef.current?.querySelector('input')?.focus(), 30)
  }
  const changePatient = (id: string) => { init.current = false; setPatientId(id); setTarget(null); setAmount(null) }

  const signed = round2((amount || 0) * (refund ? -1 : 1))
  const split = splitPayment(signed, selected ?? null)
  const errAmount = !(amount && amount > 0) ? t('v.positive') : undefined
  const errPatient = !patientId ? t('billing.v.patient') : undefined
  const errDate = !date ? t('v.date') : undefined

  const save = async () => {
    if (busy.current || license.readOnly) return
    setSubmitted(true)
    if (errAmount || errPatient || errDate || !ready) return
    busy.current = true
    setSaving(true)
    try {
      const created = await recordPayment({ patientId, invoiceId: selected?.id, amount: signed, method, date, reference, note, receivedBy: session.user?.id })
      const main = created[0]
      const name = data?.patient?.name ?? t('unknown')
      void logActivity({ type: 'payment', action: 'create', entityId: main.id, patientId, message: t(refund ? 'billing.act.refundCreated' : 'billing.act.paymentCreated', { amount: iso(money(Math.abs(signed))), patient: name }), by: session.user?.id })
      toast.toast('success', t(refund ? 'billing.payment.refundSaved' : 'billing.payment.saved'), (
        <>
          <div>{t(refund ? 'billing.payment.refundDesc' : 'billing.payment.savedDesc', { amount: ltr(money(Math.abs(signed))), method: t(`pay.${method}`) })}</div>
          <button type="button" className="bl-toast-action" onClick={() => openReceipt(main.id)}><Printer />{t('billing.payment.printReceipt')}</button>
        </>
      ), 7000)
      onSaved?.(main.id)
      onClose()
    } catch {
      busy.current = false
      toast.error(t('error'), t('tryAgain'))
    } finally { setSaving(false) }
  }

  const ro = license.readOnly
  const footer = (
    <>
      <Button variant="ghost" className="start" onClick={onClose}>{t('cancel')}</Button>
      <Button variant="primary" icon={<Wallet />} loading={saving} disabled={ro || !patientId} onClick={save}>{refund ? t('billing.payment.saveRefund') : t('billing.payment.save')}</Button>
    </>
  )

  return (
    <Modal open onClose={onClose} size="lg" title={t('billing.payment.title')} icon={<Wallet />} footer={footer} closeOnOverlay={false}
      subtitle={data?.patient ? data.patient.name : undefined}>
      <form className={`bl-pay${!patientId ? ' is-picking' : ''}`} onSubmit={e => { e.preventDefault(); void save() }}>
        {ro && <Alert tone="warning">{t('trial.readonly')}</Alert>}
        {!givenPatient && <PatientPicker value={patientId} onChange={changePatient} error={submitted ? errPatient : undefined} />}
        {!patientId ? (
          <div className="bl-muted-line row gap-2"><Info size={16} />{t('billing.payment.selectPatient')}</div>
        ) : !ready || !data ? (
          <div className="col gap-3"><Skeleton h={62} /><Skeleton h={56} /><Skeleton h={56} /></div>
        ) : (
          <>
            <div>
              <div className="bl-label">{t('billing.payment.account')}</div>
              <div className="bl-acct">
                <div className="bl-acct-cell"><div className="bl-acct-label">{t('billing.account.invoiced')}</div><Money value={data.account.invoiced} /></div>
                <div className="bl-acct-cell"><div className="bl-acct-label">{t('billing.account.paid')}</div><Money value={data.account.paid} /></div>
                <div className={`bl-acct-cell${data.account.due > 0 ? ' is-due' : data.account.due < 0 ? ' is-credit' : ''}`}>
                  <div className="bl-acct-label">{data.account.due < 0 ? t('billing.account.credit') : t('billing.account.due')}</div><Money value={Math.abs(data.account.due)} />
                </div>
              </div>
            </div>

            <div>
              <div className="bl-label">{t('billing.payment.applyTo')}</div>
              <div className="bl-targets" role="radiogroup">
                {openInvoices.map(inv => (
                  <button key={inv.id} type="button" role="radio" aria-checked={target === inv.id} className={`bl-target${target === inv.id ? ' active' : ''}`} onClick={() => choose(inv.id)}>
                    <span className="bl-radio" />
                    <span className="bl-target-main">
                      <span className="bl-target-title"><span className="num">{inv.number}</span></span>
                      <span className="bl-target-sub">{fmtDate(inv.date, lang)} · {t('total')} <Money value={inv.total} /></span>
                    </span>
                    <span className="bl-target-end">
                      <Money value={invoiceBalance(inv)} kind="due" />
                      <span className="bl-target-sub" style={{ display: 'block' }}>{t('due')}</span>
                    </span>
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={target === ON_ACCOUNT} className={`bl-target${target === ON_ACCOUNT ? ' active' : ''}`} onClick={() => choose(ON_ACCOUNT)}>
                  <span className="bl-radio" />
                  <span className="bl-target-main">
                    <span className="bl-target-title">{t('billing.payment.onAccount')}</span>
                    <span className="bl-target-sub">{openInvoices.length ? t('billing.payment.onAccountDesc') : t('billing.payment.noOpen')}</span>
                  </span>
                </button>
              </div>
            </div>

            <div className="bl-pay-grid">
              <div className="bl-amount" ref={amountRef}>
                <Field label={refund ? t('billing.payment.refundAmount') : t('amount')} required error={submitted ? errAmount : undefined}>
                  <NumberInput value={amount} onChange={setAmount} min={0} addon={clinic.currencySymbol || clinic.currency} invalid={submitted && !!errAmount} placeholder="0" aria-label={t('amount')} />
                </Field>
              </div>
              <Select label={t('billing.method')} value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} options={PAYMENT_METHODS.map(m => ({ value: m, label: t(`pay.${m}`) }))} />
              {selected && !refund && split.onAccount > 0 && (
                <Alert className="span-2" tone="info" title={t('billing.payment.splitTitle')}>
                  {t('billing.payment.splitHint', { onInvoice: ltr(money(split.onInvoice)), number: ltr(selected.number), onAccount: ltr(money(split.onAccount)) })}
                </Alert>
              )}
              {selected && refund && split.onAccount < 0 && (
                <Alert className="span-2" tone="warning">{t('billing.payment.refundSplitHint', { onInvoice: ltr(money(-split.onInvoice)), number: ltr(selected.number), onAccount: ltr(money(-split.onAccount)) })}</Alert>
              )}
              <div className={`bl-refund-row span-2${refund ? ' on' : ''}`}>
                <div className="grow">
                  <div className="strong">{t('billing.payment.refund')}</div>
                  <div className="text-xs muted">{t('billing.payment.refundHint')}</div>
                </div>
                <Switch checked={refund} onChange={e => setRefund(e.target.checked)} aria-label={t('billing.payment.refund')} />
              </div>
              <Input type="date" label={t('date')} value={date} onChange={e => setDate(e.target.value)} required error={submitted ? errDate : undefined} />
              <Input label={t('billing.payment.reference')} value={reference} onChange={e => setReference(e.target.value)} placeholder={t('billing.payment.referencePlaceholder')} />
              <div className="span-2"><Textarea label={t('notes')} value={note} onChange={e => setNote(e.target.value)} rows={2} /></div>
            </div>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
