// The daily cash report: the payments of the selected period grouped by method, with subtotals and a grand total.
import { FileBarChart2, Printer } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useClinic, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { fmtDate, fmtDateTime } from '@/lib/dates'
import { Button, Modal } from '@/ui'
import type { PaymentMethod } from '@/db/types'
import { groupByMethod, paymentStats, type Period } from './lib'
import { Money, printModalSheet, SheetHeader, shortDate, usePrintCleanup } from './shared'
import type { LedgerRow } from './PaymentsPage'
import './billing.css'

export function CashReportModal({ rows, period, filters, onClose }: { rows: LedgerRow[]; period: Period; filters: { method: PaymentMethod | ''; by?: string }; onClose: () => void }) {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  const session = useSession()
  const users = useUsers(false)
  usePrintCleanup(true)
  const name = (id?: string) => (id ? users.find(u => u.id === id)?.name ?? '—' : '—')
  const chronological = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const groups = groupByMethod(chronological)
  const stats = paymentStats(rows)
  const range = period.from === period.to ? fmtDate(period.from, lang, 'long') : `${fmtDate(period.from, lang)} – ${fmtDate(period.to, lang)}`
  const scope = [filters.method ? t(`pay.${filters.method}`) : '', filters.by ?? ''].filter(Boolean).join(' · ')

  const footer = (
    <>
      <Button variant="ghost" className="start" onClick={onClose}>{t('close')}</Button>
      <Button variant="primary" icon={<Printer />} onClick={printModalSheet}>{t('print')}</Button>
    </>
  )
  return (
    <Modal open onClose={onClose} size="xl" title={t('billing.report.title')} icon={<FileBarChart2 />} footer={footer} className="bl-modal-sheet">
      <article className="print-area bl-sheet bl-report">
        <SheetHeader clinic={clinic} title={t('billing.report.title')}
          facts={[{ label: t('period'), value: range }, ...(scope ? [{ label: t('filter'), value: scope }] : [])]} />

        <div className="bl-report-summary">
          <div><div className="bl-label">{t('billing.report.paymentsCount')}</div><span className="num">{stats.count}</span></div>
          <div><div className="bl-label">{t('billing.payments.stat.cash')}</div><Money value={stats.cash} /></div>
          <div><div className="bl-label">{t('billing.payments.stat.cardTransfer')}</div><Money value={stats.cardTransfer} /></div>
          <div className={stats.refunds > 0 ? 'is-neg' : ''}><div className="bl-label">{t('billing.payments.stat.refunds')}</div><Money value={stats.refunds} /></div>
          <div><div className="bl-label">{t('billing.report.grandTotal')}</div><Money value={stats.net} /></div>
        </div>

        {groups.length === 0 ? <div className="bl-muted-line" style={{ marginTop: 24, textAlign: 'center' }}>{t('billing.report.noPayments')}</div> : (
          <div className="bl-table-scroll"><table className="bl-items">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('patient')}</th>
                <th className="bl-hide-sm">{t('billing.invoice')}</th>
                <th className="bl-hide-sm">{t('billing.payments.receivedBy')}</th>
                <th className="bl-hide-sm">{t('reference')}</th>
                <th className="bl-n">{t('amount')}</th>
              </tr>
            </thead>
            {groups.map(g => (
              <tbody key={g.method}>
                <tr className="bl-group"><td colSpan={2}>{t(`pay.${g.method}`)} <span className="muted num">({g.count})</span></td><td colSpan={3} className="bl-hide-sm" /><td /></tr>
                {g.items.map(p => (
                  <tr key={p.id}>
                    <td className="num">{shortDate(p.date)}</td>
                    <td className="bl-desc">{p.patient?.name ?? '—'}</td>
                    <td className="bl-hide-sm">{p.invoice ? <span className="num">{p.invoice.number}</span> : t('billing.payments.onAccount')}</td>
                    <td className="bl-hide-sm">{name(p.receivedBy)}</td>
                    <td className="bl-hide-sm">{p.reference ? <span className="ltr">{p.reference}</span> : '—'}</td>
                    <td className="bl-n bl-strong"><Money value={p.amount} kind="signed" /></td>
                  </tr>
                ))}
                <tr className="bl-subtotal"><td colSpan={2}>{t('billing.report.subtotal', { method: t(`pay.${g.method}`) })}</td><td colSpan={3} className="bl-hide-sm" /><td className="bl-n"><Money value={g.total} kind="signed" /></td></tr>
              </tbody>
            ))}
          </table></div>
        )}

        <div className="bl-sheet-bottom">
          <div />
          <div className="bl-totals">
            <div className="bl-tr bl-balance is-zero"><span>{t('billing.report.grandTotal')}</span><Money value={stats.net} /></div>
          </div>
        </div>

        <div className="bl-report-foot">
          <span>{t('billing.report.preparedBy')}: <strong>{session.user?.name ?? '—'}</strong></span>
          <span>{t('billing.report.printedAt')}: <strong className="bl-date">{fmtDateTime(new Date(), lang)}</strong></span>
        </div>
        <div className="bl-sign">
          <div>{t('billing.report.preparedBy')}</div>
          <div>{t('billing.report.reviewedBy')}</div>
        </div>
      </article>
    </Modal>
  )
}
