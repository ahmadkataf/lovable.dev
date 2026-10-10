// The payment receipt: a small printable sheet. openReceipt(id) shows it from anywhere (a toast action, a table row),
// even after the screen that recorded the payment has closed, so it mounts its own small root.
import { createRoot, type Root } from 'react-dom/client'
import { useLiveQuery } from 'dexie-react-hooks'
import { Printer, ReceiptText } from 'lucide-react'
import { db } from '@/db'
import type { Lang } from '@/db/types'
import { I18nProvider, useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { fmtDate } from '@/lib/dates'
import { Button, Loading, Modal } from '@/ui'
import { invoiceBalance, receiptNo } from './lib'
import { Money, printModalSheet, SheetHeader, usePrintCleanup } from './shared'
import './billing.css'

export function ReceiptModal({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  usePrintCleanup(true)
  const data = useLiveQuery(async () => {
    const payment = await db.payments.get(paymentId)
    if (!payment) return null
    const [patient, invoice, user] = await Promise.all([
      db.patients.get(payment.patientId),
      payment.invoiceId ? db.invoices.get(payment.invoiceId) : Promise.resolve(undefined),
      payment.receivedBy ? db.users.get(payment.receivedBy) : Promise.resolve(undefined),
    ])
    return { payment, patient, invoice, user }
  }, [paymentId])

  const footer = (
    <>
      <Button variant="ghost" className="start" onClick={onClose}>{t('close')}</Button>
      <Button variant="primary" icon={<Printer />} disabled={!data} onClick={printModalSheet}>{t('print')}</Button>
    </>
  )
  const refund = !!data && data.payment.amount < 0
  return (
    <Modal open onClose={onClose} size="md" title={refund ? t('billing.receipt.refundTitle') : t('billing.receipt.title')} icon={<ReceiptText />} footer={footer} className="bl-modal-sheet">
      {data === undefined ? <Loading /> : data === null ? <div className="bl-muted-line">{t('billing.receipt.missing')}</div> : (
        <article className="print-area bl-sheet bl-receipt">
          <SheetHeader clinic={clinic} title={refund ? t('billing.receipt.refundTitle') : t('billing.receipt.title')}
            facts={[{ label: t('billing.receipt.no'), value: <span className="num">{receiptNo(data.payment.id)}</span> }, { label: t('date'), value: fmtDate(data.payment.date, lang, 'long') }]} />
          <div className={`bl-receipt-amount${refund ? ' is-refund' : ''}`}>
            <div className="bl-label">{refund ? t('billing.receipt.refundAmount') : t('billing.receipt.amount')}</div>
            <Money value={Math.abs(data.payment.amount)} />
          </div>
          <dl className="bl-kv">
            <dt>{refund ? t('billing.receipt.refundedTo') : t('billing.receipt.receivedFrom')}</dt>
            <dd>{data.patient?.name ?? t('unknown')}{data.patient && <div className="muted text-sm" style={{ fontWeight: 500 }}>{t('fileNo')} <span className="num">{data.patient.fileNo}</span></div>}</dd>
            <dt>{t('billing.method')}</dt><dd>{t(`pay.${data.payment.method}`)}</dd>
            <dt>{t('billing.receipt.for')}</dt>
            <dd>{data.invoice ? <span>{t('billing.receipt.forInvoice', { number: '' })}<span className="num">{data.invoice.number}</span></span> : t('billing.receipt.onAccount')}</dd>
            {data.invoice && <><dt>{t('billing.receipt.remaining')}</dt><dd><Money value={invoiceBalance(data.invoice)} /></dd></>}
            {data.payment.reference && <><dt>{t('reference')}</dt><dd><span className="ltr">{data.payment.reference}</span></dd></>}
            {data.payment.note && <><dt>{t('notes')}</dt><dd>{data.payment.note}</dd></>}
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
/** Shows the receipt of a payment on top of whatever is on screen. */
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
