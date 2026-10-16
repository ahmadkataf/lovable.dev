// Record a payment (or a refund) for a patient: pick the patient, see their account, choose an open invoice or
// "on account", and save. Money above the invoice balance settles the patient's other open invoices (oldest first),
// and what is left stays as credit. A refund comes back off a paid invoice (optionally lowering it: a credit note)
// or off the patient's credit, never more than that.
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
import { roundTo } from '@/lib/format'
import { Alert, Button, Checkbox, Field, Input, Modal, NumberInput, Select, Skeleton, Switch, Textarea, useToast } from '@/ui'
import { BillingError, ensureReconciled, recordPayment } from './actions'
import { accountFrom, EPS, invoiceBalance, isBillable, isOpen, isRealDate, m3, moneyDecimals, onAccountNet, previewAllocation, splitPayment } from './lib'
import { Money, PatientPicker, ltr, iso } from './shared'
import { openReceipt } from './Receipt'
import './billing.css'

/** Record a payment for a patient, optionally against one invoice; `refund` opens it as a refund. */
export interface PaymentFormModalProps { open: boolean; onClose: () => void; patientId?: string; invoiceId?: string; refund?: boolean; onSaved?: (id: string) => void }

export default function PaymentFormModal({ open, onClose, patientId, invoiceId, refund, onSaved }: PaymentFormModalProps) {
  if (!open) return null
  return <PaymentForm onClose={onClose} patientId={patientId} invoiceId={invoiceId} refund={refund} onSaved={onSaved} />
}

const ON_ACCOUNT = ''
const byDate = (a: Invoice, b: Invoice) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)

function PaymentForm({ onClose, patientId: givenPatient, invoiceId, refund: refundAtStart, onSaved }: Omit<PaymentFormModalProps, 'open'>) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const clinic = useClinic()
  const session = useSession()
  const license = useLicense()
  const toast = useToast()
  const d = moneyDecimals(clinic.currencyDecimals)
  const today = todayISO()

  const [patientId, setPatientId] = useState(givenPatient ?? '')
  const [target, setTarget] = useState<string | null>(null)    // null = not decided yet (picked when the account loads)
  const [amount, setAmount] = useState<number | null>(null)
  const [refund, setRefund] = useState(!!refundAtStart)
  const [creditNote, setCreditNote] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [date, setDate] = useState(today)
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)          // Enter pressed twice / double click must not record the payment twice
  const amountRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void ensureReconciled() }, [])
  const data = useLiveQuery(async () => {
    if (!patientId) return null
    const [patient, invoices, payments] = await Promise.all([
      db.patients.get(patientId),
      db.invoices.where('patientId').equals(patientId).toArray(),
      db.payments.where('patientId').equals(patientId).toArray(),
    ])
    return { pid: patientId, patient, invoices, account: accountFrom(invoices, payments), credit: Math.max(0, onAccountNet(payments)) }
  }, [patientId])
  const ready = !!data && data.pid === patientId

  const openInvoices = useMemo(() => (data?.invoices ?? []).filter(isOpen).sort(byDate), [data])
  // a refund can come back off any issued invoice something was paid on, newest first
  const paidInvoices = useMemo(() => (data?.invoices ?? []).filter(i => isBillable(i) && i.paid > EPS).sort((a, b) => -byDate(a, b)), [data])
  const targets = refund ? paidInvoices : openInvoices
  const selected: Invoice | undefined = target ? targets.find(i => i.id === target) : undefined
  const credit = data?.credit ?? 0

  /** The target a mode starts on: the given invoice, else (payment) the oldest open one or (refund) the credit / the last paid invoice. */
  const pickTarget = (isRefund: boolean) => {
    const list = isRefund ? paidInvoices : openInvoices
    const given = invoiceId ? list.find(i => i.id === invoiceId) : undefined
    if (given) return given.id
    if (isRefund) return credit > EPS ? ON_ACCOUNT : list[0]?.id ?? ON_ACCOUNT
    return list[0]?.id ?? ON_ACCOUNT
  }
  // first load of an account: preselect the target and fill a payment with its balance
  const init = useRef(false)
  const autoAmount = useRef<number | null>(null)       // the invoice balance the form filled in (not typed by the user)
  useEffect(() => {
    if (!ready || init.current) return
    init.current = true
    const id = pickTarget(refund)
    setTarget(id)
    const inv = openInvoices.find(i => i.id === id)
    if (!refund && inv) { autoAmount.current = invoiceBalance(inv); setAmount(autoAmount.current) }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (id: string) => {
    setTarget(id)
    const inv = openInvoices.find(i => i.id === id)
    if (inv && !refund) { autoAmount.current = invoiceBalance(inv); setAmount(autoAmount.current) }
    setTimeout(() => amountRef.current?.querySelector('input')?.focus(), 30)
  }
  const switchMode = (isRefund: boolean) => {
    setRefund(isRefund)
    setTarget(pickTarget(isRefund))
    // a balance the form filled in means nothing for the other mode; an amount the user typed is kept
    if (amount === null || amount === autoAmount.current) setAmount(null)
    setSubmitted(false)
  }
  const changePatient = (id: string) => { init.current = false; setPatientId(id); setTarget(null); setAmount(null) }

  const value = roundTo(amount || 0, d)
  const signed = refund ? -value : value
  const split = splitPayment(signed, selected ?? null)
  const preview = !refund ? previewAllocation(value, selected, openInvoices) : null
  // refunds: what comes off the invoice, what comes off the credit, and what the patient would owe afterwards
  const back = refund ? -split.onInvoice : 0
  const fromCredit = refund ? -split.onAccount : 0
  const maxRefund = m3((selected ? selected.paid : 0) + credit)
  const lowers = refund && !!selected && creditNote && back > EPS
  const owedAfter = refund && selected && !lowers ? m3(Math.max(0, back - Math.max(0, credit - fromCredit))) : 0

  const errAmount = !(amount && amount > 0) ? t('v.positive')
    : !(value > 0) ? t('billing.v.tooSmall', { unit: iso(money(Math.pow(10, -d))) })
    : refund && fromCredit > credit + EPS ? t('billing.v.refundMax', { amount: ltr(money(maxRefund)) })
    : undefined
  const errPatient = !patientId ? t('billing.v.patient') : undefined
  const errDate = !date || !isRealDate(date) ? t('v.date') : date > today ? t('billing.v.futureDate') : undefined

  const save = async () => {
    if (busy.current || license.readOnly) return
    setSubmitted(true)
    if (errAmount || errPatient || errDate || !ready) return
    busy.current = true
    setSaving(true)
    try {
      const created = await recordPayment({
        patientId, invoiceId: selected?.id, amount: signed, method, date, reference, note, receivedBy: session.user?.id,
        creditNote: lowers, creditNoteText: lowers ? t('billing.creditNote.line', { amount: iso(money(back)), date: fmtDate(date, lang), receipt: '{receipt}' }) : undefined,
      })
      const main = created[0]
      const name = data?.patient?.name ?? t('unknown')
      const actKey = !refund ? 'billing.act.paymentCreated' : lowers ? 'billing.act.creditNote' : 'billing.act.refundCreated'
      void logActivity({ type: 'payment', action: 'create', entityId: main.id, patientId, message: t(actKey, { amount: iso(money(value)), patient: name, number: iso(selected?.number ?? ''), receipt: iso(main.receiptNo ?? '') }), by: session.user?.id })
      toast.toast('success', t(refund ? 'billing.payment.refundSaved' : 'billing.payment.saved'), (
        <>
          <div>{t(refund ? 'billing.payment.refundDesc' : 'billing.payment.savedDesc', { amount: ltr(money(value)), method: t(`pay.${method}`) })}{main.receiptNo ? <> · <span className="num">{main.receiptNo}</span></> : null}</div>
          <button type="button" className="bl-toast-action" onClick={() => openReceipt(main.id)}><Printer />{t('billing.payment.printReceipt')}</button>
        </>
      ), 7000)
      onSaved?.(main.id)
      onClose()
    } catch (err) {
      busy.current = false
      toast.error(t('error'), err instanceof BillingError ? t(`billing.err.${err.code}`) : t('tryAgain'))
    } finally { setSaving(false) }
  }

  const ro = license.readOnly
  const footer = (
    <>
      <Button variant="ghost" className="start" onClick={onClose}>{t('cancel')}</Button>
      <Button variant="primary" icon={<Wallet />} loading={saving} disabled={ro || !patientId} onClick={save}>{refund ? t('billing.payment.saveRefund') : t('billing.payment.save')}</Button>
    </>
  )
  const onAccountTitle = refund ? t('billing.payment.fromCredit') : t('billing.payment.onAccount')
  const onAccountSub = refund
    ? (credit > EPS ? t('billing.payment.creditAvailable', { amount: ltr(money(credit)) }) : t('billing.payment.noCredit'))
    : openInvoices.length ? t('billing.payment.onAccountDesc') : t('billing.payment.noOpen')

  return (
    <Modal open onClose={onClose} size="lg" title={refund ? t('billing.payment.refundTitle') : t('billing.payment.title')} icon={<Wallet />} footer={footer} closeOnOverlay={false}
      subtitle={data?.patient ? data.patient.name : undefined}>
      {/* noValidate: Enter goes through save(), which shows the form's own messages (a date after today, an amount
          finer than the currency unit) instead of the browser's bubble in the system language */}
      <form noValidate className={`bl-pay${!patientId ? ' is-picking' : ''}`} onSubmit={e => { e.preventDefault(); void save() }}>
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
                <div className={`bl-acct-cell${data.account.due > EPS ? ' is-due' : data.account.due < -EPS ? ' is-credit' : ''}`}>
                  <div className="bl-acct-label">{data.account.due < -EPS ? t('billing.account.credit') : t('billing.account.due')}</div><Money value={Math.abs(data.account.due)} />
                </div>
              </div>
            </div>

            <div className={`bl-refund-row${refund ? ' on' : ''}`}>
              <div className="grow">
                <div className="strong">{t('billing.payment.refund')}</div>
                <div className="text-xs muted">{t('billing.payment.refundHint')}</div>
              </div>
              <Switch checked={refund} onChange={e => switchMode(e.target.checked)} aria-label={t('billing.payment.refund')} />
            </div>

            <div>
              <div className="bl-label">{refund ? t('billing.payment.refundFrom') : t('billing.payment.applyTo')}</div>
              <div className="bl-targets" role="radiogroup">
                {targets.map(inv => (
                  <button key={inv.id} type="button" role="radio" aria-checked={target === inv.id} className={`bl-target${target === inv.id ? ' active' : ''}`} onClick={() => choose(inv.id)}>
                    <span className="bl-radio" />
                    <span className="bl-target-main">
                      <span className="bl-target-title"><span className="num">{inv.number}</span></span>
                      <span className="bl-target-sub">{fmtDate(inv.date, lang)} · {t('total')} <Money value={inv.total} /></span>
                    </span>
                    <span className="bl-target-end">
                      {refund ? <Money value={inv.paid} /> : <Money value={invoiceBalance(inv)} kind="due" />}
                      <span className="bl-target-sub" style={{ display: 'block' }}>{refund ? t('paid') : t('due')}</span>
                    </span>
                  </button>
                ))}
                {(!refund || credit > EPS || !targets.length) && (
                  <button type="button" role="radio" aria-checked={target === ON_ACCOUNT} className={`bl-target${target === ON_ACCOUNT ? ' active' : ''}`} onClick={() => choose(ON_ACCOUNT)}>
                    <span className="bl-radio" />
                    <span className="bl-target-main">
                      <span className="bl-target-title">{onAccountTitle}</span>
                      <span className="bl-target-sub">{onAccountSub}</span>
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="bl-pay-grid">
              <div className="bl-amount" ref={amountRef}>
                <Field label={refund ? t('billing.payment.refundAmount') : t('amount')} required error={submitted ? errAmount : undefined}
                  hint={refund && !(submitted && errAmount) ? t('billing.payment.refundUpTo', { amount: ltr(money(maxRefund)) }) : undefined}>
                  <NumberInput value={amount} onChange={setAmount} min={0} decimals={d} addon={clinic.currencySymbol || clinic.currency} invalid={submitted && !!errAmount} placeholder="0" aria-label={t('amount')} />
                </Field>
              </div>
              <Select label={t('billing.method')} value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} options={PAYMENT_METHODS.map(m => ({ value: m, label: t(`pay.${m}`) }))} />
              {preview && value > 0 && (preview.lines.length > 1 || (preview.credit > EPS && (preview.lines.length > 0 || openInvoices.length > 0))) && (
                <Alert className="span-2" tone="info" title={t('billing.payment.splitTitle')}>
                  <ul className="bl-split-list">
                    {preview.lines.map(l => <li key={l.id}><span>{t('billing.payment.toInvoice', { number: ltr(l.number) })}</span><Money value={l.amount} /></li>)}
                    {preview.credit > EPS && <li><span>{t('billing.payment.toCredit')}</span><Money value={preview.credit} /></li>}
                  </ul>
                </Alert>
              )}
              {refund && selected && back > EPS && (
                <div className="span-2 bl-credit-note">
                  <Checkbox checked={creditNote} onChange={e => setCreditNote(e.target.checked)}
                    label={<span className="col" style={{ gap: 2 }}><span className="strong">{t('billing.payment.creditNote', { amount: ltr(money(back)), number: ltr(selected.number) })}</span><span className="text-xs muted">{t('billing.payment.creditNoteHint')}</span></span>} />
                </div>
              )}
              {refund && selected && fromCredit > EPS && !(submitted && errAmount) && (
                <Alert className="span-2" tone="info">{t('billing.payment.refundSplitHint', { onInvoice: ltr(money(back)), number: ltr(selected.number), onAccount: ltr(money(fromCredit)) })}</Alert>
              )}
              {owedAfter > EPS && (
                <Alert className="span-2" tone="warning">{t('billing.payment.refundOwes', { amount: ltr(money(owedAfter)), number: ltr(selected!.number) })}</Alert>
              )}
              <Input type="date" label={t('date')} value={date} max={today} onChange={e => setDate(e.target.value)} required error={submitted ? errDate : undefined} />
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
