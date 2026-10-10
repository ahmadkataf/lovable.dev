// The patient's account statement: invoices and payments in date order with a running balance. Printable.
import { useLiveQuery } from 'dexie-react-hooks'
import { Printer, ScrollText } from 'lucide-react'
import { db } from '@/db'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { fmtDate } from '@/lib/dates'
import { formatPhone } from '@/lib/format'
import { Button, Loading, Modal } from '@/ui'
import { accountFrom, buildStatement } from './lib'
import { Money, printModalSheet, SheetHeader, shortDate, usePrintCleanup } from './shared'
import './billing.css'

export function StatementModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  usePrintCleanup(true)
  const data = useLiveQuery(async () => {
    const [patient, invoices, payments] = await Promise.all([
      db.patients.get(patientId),
      db.invoices.where('patientId').equals(patientId).toArray(),
      db.payments.where('patientId').equals(patientId).toArray(),
    ])
    return { patient, rows: buildStatement(invoices, payments), account: accountFrom(invoices, payments), numbers: new Map(invoices.map(i => [i.id, i.number])) }
  }, [patientId])

  const footer = (
    <>
      <Button variant="ghost" className="start" onClick={onClose}>{t('close')}</Button>
      <Button variant="primary" icon={<Printer />} disabled={!data} onClick={printModalSheet}>{t('print')}</Button>
    </>
  )
  return (
    <Modal open onClose={onClose} size="xl" title={t('billing.statement.title')} icon={<ScrollText />} footer={footer} className="bl-modal-sheet">
      {!data ? <Loading /> : (
        <article className="print-area bl-sheet bl-statement">
          <SheetHeader clinic={clinic} title={t('billing.statement.title')} facts={[{ label: t('billing.statement.asOf'), value: fmtDate(todayISO(), lang, 'long') }]} />
          <section className="bl-parties">
            <div className="bl-party">
              <div className="bl-label">{t('patient')}</div>
              <div className="bl-party-name">{data.patient?.name ?? t('unknown')}</div>
              <div className="bl-party-meta">
                {data.patient && <span>{t('fileNo')}: <span className="num">{data.patient.fileNo}</span></span>}
                {data.patient?.phone && <span className="ltr">{formatPhone(data.patient.phone)}</span>}
              </div>
            </div>
            <div className="bl-party">
              <div className="bl-label">{t('billing.payment.account')}</div>
              <dl className="bl-kv">
                <dt>{t('billing.account.invoiced')}</dt><dd><Money value={data.account.invoiced} /></dd>
                <dt>{t('billing.account.paid')}</dt><dd><Money value={data.account.paid} /></dd>
                <dt>{data.account.due < 0 ? t('billing.account.credit') : t('billing.account.due')}</dt><dd><Money value={Math.abs(data.account.due)} kind={data.account.due > 0 ? 'due' : undefined} /></dd>
              </dl>
            </div>
          </section>

          {data.rows.length === 0 ? <div className="bl-muted-line" style={{ marginTop: 24, textAlign: 'center' }}>{t('billing.statement.empty')}</div> : (
            <div className="bl-table-scroll"><table className="bl-items">
              <thead>
                <tr>
                  <th className="bl-hide-sm">{t('date')}</th>
                  <th>{t('billing.statement.movement')}</th>
                  <th className="bl-n bl-hide-sm">{t('billing.statement.debit')}</th>
                  <th className="bl-n bl-hide-sm">{t('billing.statement.credit')}</th>
                  <th className="bl-n bl-only-sm">{t('amount')}</th>
                  <th className="bl-n">{t('billing.statement.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.key}>
                    <td className="num bl-hide-sm">{shortDate(r.date)}</td>
                    <td className="bl-desc">
                      {r.kind === 'invoice' ? <>{t('billing.invoice')} <span className="num">{r.number}</span></>
                        : <>{r.kind === 'refund' ? t('billing.payments.refund') : t('billing.statement.paymentLabel')} · {t(`pay.${r.method}`)}{r.invoiceId && data.numbers.get(r.invoiceId) ? <span className="muted"> — <span className="num">{data.numbers.get(r.invoiceId)}</span></span> : null}</>}
                      <div className="bl-only-sm bl-row-date num">{shortDate(r.date)}</div>
                    </td>
                    <td className="bl-n bl-hide-sm">{r.debit ? <Money value={r.debit} /> : <span className="bl-dash">—</span>}</td>
                    <td className="bl-n bl-hide-sm">{r.credit ? <Money value={r.credit} /> : <span className="bl-dash">—</span>}</td>
                    {/* phones: debit and credit in one signed column (+ owed, − paid) */}
                    <td className="bl-n bl-only-sm">{r.debit ? <Money value={r.debit} /> : <Money value={-r.credit} className="bl-credit-amt" />}</td>
                    <td className="bl-n bl-strong"><Money value={r.balance} kind="due" /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}

          <div className="bl-sheet-bottom">
            <div />
            <div className="bl-totals">
              <div className={`bl-tr bl-balance${data.account.due <= 0 ? ' is-zero' : ''}`}><span>{data.account.due < 0 ? t('billing.account.credit') : t('billing.statement.closing')}</span><Money value={Math.abs(data.account.due)} /></div>
            </div>
          </div>
          <footer className="bl-sheet-foot">
            {clinic.invoiceFooter && <div className="bl-footer-text">{clinic.invoiceFooter}</div>}
            <div className="bl-generated">{t('billing.sheet.generatedBy')}</div>
          </footer>
        </article>
      )}
    </Modal>
  )
}
