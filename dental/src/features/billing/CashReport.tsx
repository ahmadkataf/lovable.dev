// The daily cash report: the hand-overs (receipts) of the selected period grouped by method, with subtotals and a
// grand total. One receipt is one line, however many invoices it settled.
import { useLiveQuery } from 'dexie-react-hooks'
import { FileBarChart2, Printer } from 'lucide-react'
import { db } from '@/db'
import type { Invoice, PaymentMethod } from '@/db/types'
import { useI18n } from '@/i18n'
import { useClinic, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { fmtDate, fmtDateTime } from '@/lib/dates'
import { Button, Modal } from '@/ui'
import { groupByMethod, paymentStats, type Period, type ReceiptGroup } from './lib'
import { usePagePatients } from './patientIndex'
import { docTitle, Money, printModalSheet, SheetHeader, shortDate, usePrintCleanup, usePrintFooter } from './shared'
import './billing.css'

export function CashReportModal({ rows, period, filters, onClose }: { rows: ReceiptGroup[]; period: Period; filters: { method: PaymentMethod | ''; by?: string }; onClose: () => void }) {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  const session = useSession()
  const users = useUsers(false)
  const patients = usePagePatients(rows.map(g => g.patientId))
  usePrintCleanup(true)
  const ids = [...new Set(rows.flatMap(g => g.allocations.map(a => a.invoiceId)))].sort().join(',')
  const numbers = useLiveQuery(async () => {
    const list = ids ? ids.split(',') : []
    const found = list.length ? await db.invoices.bulkGet(list) : []
    return new Map(found.filter((i): i is Invoice => !!i).map(i => [i.id, i.number]))
  }, [ids])
  const name = (id?: string) => (id ? users.find(u => u.id === id)?.name ?? '—' : '—')
  const chronological = [...rows].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
  const groups = groupByMethod(chronological)
  const stats = paymentStats(rows)
  const range = period.from === period.to ? fmtDate(period.from, lang, 'long') : `${fmtDate(period.from, lang)} – ${fmtDate(period.to, lang)}`
  const scope = [filters.method ? t(`billing.method.${filters.method}`) : '', filters.by ?? ''].filter(Boolean).join(' · ')
  const invoicesOf = (g: ReceiptGroup) => {
    const list = g.allocations.map(a => numbers?.get(a.invoiceId) ?? '…')
    if (!list.length) return g.amount < 0 ? t('billing.payments.fromCredit') : t('billing.payments.onAccount')
    return <span className="num">{list.join(' + ')}</span>
  }

  const docName = docTitle(t('billing.report.title'), range)
  const pageFoot = usePrintFooter(docName)
  const footer = (
    <>
      <Button variant="ghost" className="start" onClick={onClose}>{t('close')}</Button>
      <Button variant="primary" icon={<Printer />} onClick={() => printModalSheet(docName)}>{t('print')}</Button>
    </>
  )
  return (
    <Modal open onClose={onClose} size="xl" title={t('billing.report.title')} icon={<FileBarChart2 />} footer={footer} className="bl-modal-sheet">
      <article className="print-area bl-sheet bl-report" style={pageFoot.style}>
        {pageFoot.node}
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
          <div className="bl-table-scroll"><table className="bl-items bl-cash">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th className="bl-hide-sm">{t('billing.receipt.noShort')}</th>
                <th>{t('patient')}</th>
                <th className="bl-hide-sm">{t('billing.invoice')}</th>
                <th className="bl-hide-sm">{t('billing.payments.receivedBy')}</th>
                <th className="bl-n">{t('amount')}</th>
              </tr>
            </thead>
            {groups.map(g => (
              <tbody key={g.method}>
                <tr className="bl-group"><td colSpan={2}>{t(`billing.method.${g.method}`)} <span className="muted num">({g.count})</span></td><td colSpan={3} className="bl-hide-sm" /><td /></tr>
                {g.items.map(p => (
                  <tr key={p.key}>
                    <td className="num">{shortDate(p.date)}</td>
                    <td className="bl-hide-sm num">{p.label}</td>
                    <td className="bl-desc bl-name" dir="auto">{patients?.get(p.patientId)?.name ?? '—'}</td>
                    <td className="bl-hide-sm">{invoicesOf(p)}</td>
                    <td className="bl-hide-sm bl-name">{name(p.receivedBy)}</td>
                    <td className="bl-n bl-strong"><Money value={p.amount} kind="signed" /></td>
                  </tr>
                ))}
                <tr className="bl-subtotal"><td colSpan={2}>{t('billing.report.subtotal', { method: t(`billing.method.${g.method}`) })}</td><td colSpan={3} className="bl-hide-sm" /><td className="bl-n"><Money value={g.total} kind="signed" /></td></tr>
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
