// The invoice as the patient receives it: an A4-like sheet that prints cleanly in Arabic and English.
import { Wallet } from 'lucide-react'
import type { Clinic, Invoice, Patient, Payment, User } from '@/db/types'
import { useI18n } from '@/i18n'
import { fmtDate } from '@/lib/dates'
import { formatPhone } from '@/lib/format'
import { invoiceBalance, isDraftNumber } from './lib'
import { Money, SheetHeader } from './shared'
import './billing.css'

export function InvoiceSheet({ invoice, patient, doctor, payments, clinic }: { invoice: Invoice; patient?: Patient; doctor?: User; payments: Payment[]; clinic: Clinic }) {
  const { t, lang } = useI18n()
  const st = invoice.status
  const balance = invoiceBalance(invoice)
  const draft = st === 'draft' || isDraftNumber(invoice.number)
  const showTooth = invoice.items.some(i => i.tooth)
  const showDiscount = invoice.items.some(i => i.discount > 0)
  const lastPayment = payments.length ? payments[payments.length - 1].date : undefined
  const title = invoice.taxPercent > 0 ? t('billing.sheet.taxInvoice') : t('billing.sheet.invoice')

  return (
    <article className={`print-area bl-sheet bl-status-${st}`} aria-label={title}>
      {(st === 'cancelled' || st === 'draft') && <div className="bl-watermark" aria-hidden>{t(`billing.stamp.${st}`)}</div>}
      <SheetHeader clinic={clinic} title={title} number={draft ? t('billing.draftNumber') : invoice.number}
        facts={[
          { label: t('billing.issueDate'), value: fmtDate(invoice.date, lang, 'long') },
          ...(invoice.dueDate ? [{ label: t('billing.dueDate'), value: fmtDate(invoice.dueDate, lang, 'long') }] : []),
        ]} />

      <section className="bl-parties">
        <div className="bl-party">
          <div className="bl-label">{t('billing.sheet.billTo')}</div>
          <div className="bl-party-name">{patient?.name ?? t('unknown')}</div>
          <div className="bl-party-meta">
            {patient && <span>{t('fileNo')}: <span className="num">{patient.fileNo}</span></span>}
            {patient?.phone && <span className="ltr">{formatPhone(patient.phone)}</span>}
            {patient?.address && <span>{patient.address}</span>}
          </div>
        </div>
        <div className="bl-party">
          <div className="bl-label">{t('details')}</div>
          <dl className="bl-kv">
            <dt>{t('billing.invoiceNo')}</dt><dd className="num">{draft ? t('billing.draftNumber') : invoice.number}</dd>
            <dt>{t('date')}</dt><dd>{fmtDate(invoice.date, lang)}</dd>
            {doctor && <><dt>{t('billing.sheet.treatingDoctor')}</dt><dd>{doctor.name}</dd></>}
            <dt>{t('status')}</dt><dd>{t(`inv.${st}`)}</dd>
          </dl>
        </div>
      </section>

      <table className="bl-items">
        <thead>
          <tr>
            <th className="bl-idx">#</th>
            <th>{t('description')}</th>
            {showTooth && <th className="bl-c">{t('tooth')}</th>}
            <th className="bl-c">{t('qty')}</th>
            <th className="bl-n bl-hide-sm">{t('unitPrice')}</th>
            {showDiscount && <th className="bl-n bl-hide-sm">{t('discount')}</th>}
            <th className="bl-n">{t('total')}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={it.id}>
              <td className="bl-idx num">{i + 1}</td>
              <td className="bl-desc">{it.description}</td>
              {showTooth && <td className="bl-c num">{it.tooth ?? '—'}</td>}
              <td className="bl-c num">{it.qty}</td>
              <td className="bl-n bl-hide-sm"><Money value={it.unitPrice} /></td>
              {showDiscount && <td className="bl-n bl-hide-sm">{it.discount > 0 ? <Money value={-it.discount} /> : '—'}</td>}
              <td className="bl-n bl-strong"><Money value={it.total} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="bl-sheet-bottom">
        <div className="bl-notes-block">
          {st !== 'draft' && st !== 'cancelled' && (
            <div className="bl-stamp-wrap">
              <div className={`bl-stamp ${st}`} role="img" aria-label={t(`billing.stamp.${st}`)}>
                {t(`billing.stamp.${st}`)}
                {st === 'paid' && lastPayment && <small className="bl-date">{fmtDate(lastPayment, lang)}</small>}
              </div>
            </div>
          )}
          {invoice.notes && <div className="bl-note">{invoice.notes}</div>}
        </div>
        <div className="bl-totals">
          <div className="bl-tr"><span>{t('subtotal')}</span><Money value={invoice.subtotal} /></div>
          {invoice.discount > 0 && <div className="bl-tr"><span>{t('discount')}</span><Money value={-invoice.discount} /></div>}
          {invoice.tax > 0 && <div className="bl-tr"><span>{t('tax')} (<span className="num">{invoice.taxPercent}%</span>)</span><Money value={invoice.tax} /></div>}
          <div className="bl-tr bl-grand"><span>{t('total')}</span><Money value={invoice.total} /></div>
          {st !== 'draft' && <div className="bl-tr"><span>{t('paid')}</span><Money value={invoice.paid} /></div>}
          {st !== 'draft' && st !== 'cancelled' && (
            <div className={`bl-tr bl-balance${balance <= 0 ? ' is-zero' : ''}`}><span>{t('billing.sheet.balanceDue')}</span><Money value={balance} /></div>
          )}
        </div>
      </section>

      {st !== 'draft' && (
        <section className="bl-section">
          <div className="bl-section-label"><Wallet />{t('billing.sheet.paymentsReceived')}</div>
          {payments.length === 0 ? <div className="bl-muted-line">{t('billing.sheet.noPayments')}</div> : (
            <table className="bl-items bl-items-sm">
              <thead><tr><th>{t('date')}</th><th>{t('billing.method')}</th><th className="bl-hide-sm">{t('reference')}</th><th className="bl-n">{t('amount')}</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="bl-date">{fmtDate(p.date, lang)}</td>
                    <td>{t(`pay.${p.method}`)}{p.amount < 0 && <> · {t('billing.payments.refund')}</>}</td>
                    <td className="bl-hide-sm">{p.reference ? <span className="ltr">{p.reference}</span> : '—'}</td>
                    <td className="bl-n bl-strong"><Money value={p.amount} kind="signed" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <footer className="bl-sheet-foot">
        {clinic.invoiceFooter && <div className="bl-footer-text">{clinic.invoiceFooter}</div>}
        <div className="bl-thanks">{t('billing.sheet.thanks')}</div>
        <div className="bl-generated">{t('billing.sheet.generatedBy')}</div>
      </footer>
    </article>
  )
}
