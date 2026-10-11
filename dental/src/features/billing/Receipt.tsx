// The payment receipt: one hand-over (all the rows saved together: the part applied to each invoice and the part
// kept as credit) on a small printable sheet. openReceipt(id) shows it from anywhere (a toast action, a table row),
// even after the screen that recorded the payment has closed, so it mounts its own small root.
import { createRoot, type Root } from 'react-dom/client'
import { useLiveQuery } from 'dexie-react-hooks'
import { Printer, ReceiptText } from 'lucide-react'
import { db } from '@/db'
import type { Invoice, Lang } from '@/db/types'
import { I18nProvider, useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { fmtDate } from '@/lib/dates'
import { Button, Loading, Modal } from '@/ui'
import { groupReceipts, invoiceBalance, receiptKey } from './lib'
import { docTitle, Money, printModalSheet, SheetHeader, usePrintCleanup } from './shared'
import './billing.css'

export function ReceiptModal({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  usePrintCleanup(true)
  const data = useLiveQuery(async () => {
    const payment = await db.payments.get(paymentId)
    if (!payment) return null
    const key = receiptKey(payment)
    const siblings = (await db.payments.where('patientId').equals(payment.patientId).toArray()).filter(p => receiptKey(p) === key)
    const group = groupReceipts(siblings.length ? siblings : [payment])[0]
    const [patient, invoices, user] = await Promise.all([
      db.patients.get(payment.patientId),
      db.invoices.bulkGet(group.allocations.map(a => a.invoiceId)),
      group.receivedBy ? db.users.get(group.receivedBy) : Promise.resolve(undefined),
    ])
    return { group, patient, invoices: new Map(invoices.filter((i): i is Invoice => !!i).map(i => [i.id, i])), user }
  }, [paymentId])

  const refund = !!data && data.group.amount < 0
  const title = refund ? t('billing.receipt.refundTitle') : t('billing.receipt.title')
  const footer = (
    <>
      <Button variant="ghost" className="start" onClick={onClose}>{t('close')}</Button>
      <Button variant="primary" icon={<Printer />} disabled={!data} onClick={() => printModalSheet(data ? docTitle(`${title} ${data.group.label}`, data.patient?.name) : undefined)}>{t('print')}</Button>
    </>
  )
  const g = data?.group
  const single = g && g.allocations.length === 1 && Math.abs(g.onAccount) < 0.0005 ? data!.invoices.get(g.allocations[0].invoiceId) : undefined
  const parts = g ? g.allocations.length + (Math.abs(g.onAccount) >= 0.0005 ? 1 : 0) : 0
  return (
    <Modal open onClose={onClose} size="md" title={title} icon={<ReceiptText />} footer={footer} className="bl-modal-sheet">
      {data === undefined ? <Loading /> : data === null || !g ? <div className="bl-muted-line">{t('billing.receipt.missing')}</div> : (
        <article className="print-area bl-sheet bl-receipt">
          <SheetHeader clinic={clinic} title={title}
            facts={[{ label: t('billing.receipt.no'), value: <span className="num">{g.label}</span> }, { label: t('date'), value: fmtDate(g.date, lang, 'long') }]} />
          <div className={`bl-receipt-amount${refund ? ' is-refund' : ''}`}>
            <div className="bl-label">{refund ? t('billing.receipt.refundAmount') : t('billing.receipt.amount')}</div>
            <Money value={Math.abs(g.amount)} />
          </div>
          <dl className="bl-kv">
            <dt>{refund ? t('billing.receipt.refundedTo') : t('billing.receipt.receivedFrom')}</dt>
            <dd><span dir="auto">{data.patient?.name ?? t('unknown')}</span>{data.patient && <div className="muted text-sm" style={{ fontWeight: 500 }}>{t('fileNo')} <span className="num">{data.patient.fileNo}</span></div>}</dd>
            <dt>{t('billing.method')}</dt><dd>{t(`pay.${g.method}`)}</dd>
            <dt>{refund ? t('billing.receipt.refundFor') : t('billing.receipt.for')}</dt>
            <dd>
              {single ? <span>{t('billing.receipt.forInvoice', { number: '' })}<span className="num">{single.number}</span></span>
                : parts === 0 || (g.allocations.length === 0) ? (refund ? t('billing.receipt.fromCredit') : t('billing.receipt.onAccount'))
                : (
                  <ul className="bl-receipt-split">
                    {[...g.allocations].sort((a, b) => ((data.invoices.get(a.invoiceId)?.number ?? '') < (data.invoices.get(b.invoiceId)?.number ?? '') ? -1 : 1)).map(a => (
                      <li key={a.invoiceId}><span>{t('billing.receipt.forInvoice', { number: '' })}<span className="num">{data.invoices.get(a.invoiceId)?.number ?? '—'}</span></span><Money value={Math.abs(a.amount)} /></li>
                    ))}
                    {Math.abs(g.onAccount) >= 0.0005 && <li><span>{refund ? t('billing.receipt.fromCredit') : t('billing.receipt.keptCredit')}</span><Money value={Math.abs(g.onAccount)} /></li>}
                  </ul>
                )}
            </dd>
            {single && <><dt>{t('billing.receipt.remaining')}</dt><dd><Money value={invoiceBalance(single)} /></dd></>}
            {g.reference && <><dt>{t('reference')}</dt><dd><span className="ltr">{g.reference}</span></dd></>}
            {g.note && <><dt>{t('notes')}</dt><dd>{g.note}</dd></>}
            <dt>{t('billing.receipt.receivedBy')}</dt><dd>{data.user?.name ?? '—'}</dd>
          </dl>
          <div className="bl-sign">
            <div>{t('billing.receipt.receivedBy')}</div>
            <div>{t('billing.receipt.signature')}</div>
          </div>
          <footer className="bl-sheet-foot">
            <div className="bl-thanks">{t('billing.receipt.thanks')}</div>
            <div className="bl-generated">{t('billing.sheet.generatedBy')}</div>
          </footer>
        </article>
      )}
    </Modal>
  )
}

let host: { root: Root; el: HTMLElement } | null = null
/** Shows the receipt of a payment (its whole hand-over) on top of whatever is on screen. */
export function openReceipt(paymentId: string) {
  closeReceipt()
  const el = document.createElement('div')
  el.className = 'bl-receipt-host'
  document.body.appendChild(el)
  const root = createRoot(el)
  const lang: Lang = document.documentElement.lang === 'en' ? 'en' : 'ar'
  host = { root, el }
  root.render(<I18nProvider initial={lang}><ReceiptModal paymentId={paymentId} onClose={closeReceipt} /></I18nProvider>)
}
export function closeReceipt() {
  if (!host) return
  const h = host
  host = null
  setTimeout(() => { h.root.unmount(); h.el.remove() }, 0)
}
