// The "billing" tab of the patient profile: account cards, invoices, payments and a printable statement.
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BadgeCheck, ChevronLeft, ChevronRight, FileText, Printer, Receipt, ScrollText, Wallet } from 'lucide-react'
import { db } from '@/db'
import type { Invoice } from '@/db/types'
import { useI18n } from '@/i18n'
import { useIsMobile, useUsers } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { fmtDate } from '@/lib/dates'
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, IconButton, Skeleton, StatCard, type Column } from '@/ui'
import { accountFrom, invoiceBalance, isDraftNumber } from './lib'
import { MethodBadge, Money, StatusBadge } from './shared'
import { openReceipt } from './Receipt'
import { StatementModal } from './Statement'
import InvoiceFormModal from './InvoiceFormModal'
import './billing.css'

const PaymentFormModal = lazy(() => import('./PaymentFormModal'))

/** A tab of the patient profile. Receives the patient id and renders its own data. */
export default function PatientBillingTab({ patientId }: { patientId: string }) {
  const { t, lang, isRTL } = useI18n()
  const navigate = useNavigate()
  const license = useLicense()
  const isMobile = useIsMobile()
  const users = useUsers(false)
  const [newInvoice, setNewInvoice] = useState(false)
  const [newPayment, setNewPayment] = useState(false)
  const [statement, setStatement] = useState(false)

  const data = useLiveQuery(async () => {
    const [invoices, payments] = await Promise.all([
      db.invoices.where('patientId').equals(patientId).toArray(),
      db.payments.where('patientId').equals(patientId).toArray(),
    ])
    invoices.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    payments.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    return { invoices, payments, account: accountFrom(invoices, payments) }
  }, [patientId])
  const invNumber = useMemo(() => new Map((data?.invoices ?? []).map(i => [i.id, i])), [data])
  const userName = (id?: string) => (id ? users.find(u => u.id === id)?.name ?? '—' : '—')
  const ro = license.readOnly
  const Chev = isRTL ? ChevronLeft : ChevronRight

  if (data === undefined) {
    return (
      <div className="bl-tab">
        <div className="grid grid-3 bl-stats">{[0, 1, 2].map(i => <div key={i} className="card stat-card"><Skeleton w={46} h={46} r={14} /><div className="grow col gap-2"><Skeleton w="50%" /><Skeleton w="70%" h={24} /></div></div>)}</div>
        <div className="card card-pad col gap-3"><Skeleton h={18} w="30%" /><Skeleton h={40} /><Skeleton h={40} /></div>
      </div>
    )
  }
  const { invoices, payments, account } = data
  const due = account.due

  const invColumns: Column<Invoice>[] = [
    { key: 'number', header: t('number'), render: i => (isDraftNumber(i.number) ? <span className="muted strong">{t('billing.draftNumber')}</span> : <Link className="bl-num-link num" to={`/invoices/${i.id}`} onClick={e => e.stopPropagation()}>{i.number}</Link>) },
    { key: 'date', header: t('date'), render: i => <span className="bl-date">{fmtDate(i.date, lang)}</span> },
    { key: 'total', header: t('total'), className: 'num', render: i => <Money value={i.total} strong /> },
    { key: 'paid', header: t('paid'), className: 'num', hideBelow: 'md', render: i => (i.status === 'draft' ? <span className="bl-dash">—</span> : <Money value={i.paid} kind="muted" />) },
    { key: 'due', header: t('due'), className: 'num', render: i => (i.status === 'draft' || i.status === 'cancelled' ? <span className="bl-dash">—</span> : <Money value={invoiceBalance(i)} kind="due" />) },
    { key: 'status', header: t('status'), render: i => <StatusBadge status={i.status} /> },
    { key: 'open', header: '', className: 'actions', width: 48, render: () => <Chev size={18} className="muted" /> },
  ]
  const payColumns: Column<(typeof payments)[number]>[] = [
    { key: 'date', header: t('date'), render: p => <span className="bl-date">{fmtDate(p.date, lang)}</span> },
    { key: 'invoice', header: t('billing.invoice'), render: p => { const inv = p.invoiceId ? invNumber.get(p.invoiceId) : undefined; return inv ? <Link className="bl-num-link num" to={`/invoices/${inv.id}`} onClick={e => e.stopPropagation()}>{inv.number}</Link> : <Badge tone="outline">{t('billing.payments.onAccount')}</Badge> } },
    { key: 'method', header: t('billing.method'), render: p => <MethodBadge method={p.method} /> },
    { key: 'by', header: t('billing.payments.receivedBy'), hideBelow: 'lg', render: p => userName(p.receivedBy) },
    { key: 'amount', header: t('amount'), className: 'num', render: p => <Money value={p.amount} kind="signed" strong /> },
    { key: 'receipt', header: '', className: 'actions', width: 56, render: p => <IconButton label={t('billing.payment.printReceipt')} size="sm" variant="ghost" className="bl-menu-btn" onClick={e => { e.stopPropagation(); openReceipt(p.id) }}><Printer /></IconButton> },
  ]

  return (
    <div className="bl-tab">
      <div className="grid grid-3 bl-stats">
        <StatCard tone="primary" icon={<FileText />} label={t('billing.account.invoiced')} value={<Money value={account.invoiced} />} sub={t('billing.invoicesCount', { n: invoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled').length })} />
        <StatCard tone="success" icon={<Wallet />} label={t('billing.account.paid')} value={<Money value={account.paid} />} sub={t('billing.payments.count', { n: payments.length })} />
        <StatCard tone={due > 0 ? 'danger' : 'success'} icon={due > 0 ? <Receipt /> : <BadgeCheck />} label={due < 0 ? t('billing.account.credit') : t('billing.account.due')}
          value={<Money value={Math.abs(due)} kind={due > 0 ? 'due' : undefined} />} sub={due === 0 ? t('billing.accountSettled') : undefined} />
      </div>

      <div className="bl-tab-actions">
        <Button variant="primary" icon={<Receipt />} disabled={ro} onClick={() => setNewInvoice(true)}>{t('billing.newInvoice')}</Button>
        <Button variant="secondary" icon={<Wallet />} disabled={ro} onClick={() => setNewPayment(true)}>{t('nav.newPayment')}</Button>
        <Button variant="secondary" icon={<ScrollText />} onClick={() => setStatement(true)} disabled={!invoices.length && !payments.length}>{t('billing.account.statement')}</Button>
      </div>

      <Card>
        <CardHeader title={<>{t('billing.title')}<span className="bl-count num">{invoices.length}</span></>} icon={<Receipt />} />
        {invoices.length === 0 ? (
          <EmptyState compact icon={<Receipt />} title={t('billing.account.noInvoices')} description={t('billing.empty.patientDesc')}
            actions={<Button variant="primary" size="sm" icon={<Receipt />} disabled={ro} onClick={() => setNewInvoice(true)}>{t('billing.newInvoice')}</Button>} />
        ) : isMobile ? (
          <div className="bl-mlist">
            {invoices.map(i => (
              <div key={i.id} className="bl-mcard" role="button" tabIndex={0} onClick={() => navigate(`/invoices/${i.id}`)}>
                <div className="bl-mcard-main">
                  <div className="bl-mcard-title">{isDraftNumber(i.number) ? t('billing.draftNumber') : <span className="num">{i.number}</span>}</div>
                  <div className="bl-mcard-sub"><span className="bl-date">{fmtDate(i.date, lang)}</span><StatusBadge status={i.status} size="sm" /></div>
                </div>
                <div className="bl-mcard-end"><Money value={i.total} strong />{invoiceBalance(i) > 0 && <span className="text-xs"><Money value={invoiceBalance(i)} kind="due" /></span>}</div>
              </div>
            ))}
          </div>
        ) : (
          <DataTable className="bl-table bl-flat" columns={invColumns} rows={invoices} rowKey={i => i.id} onRowClick={i => navigate(`/invoices/${i.id}`)}
            rowClassName={i => (i.status === 'cancelled' ? 'bl-row-muted' : undefined)} />
        )}
      </Card>

      <Card>
        <CardHeader title={<>{t('nav.payments')}<span className="bl-count num">{payments.length}</span></>} icon={<Wallet />} />
        {payments.length === 0 ? (
          <EmptyState compact icon={<Wallet />} title={t('billing.account.noPayments')} description={t('billing.payments.patientDesc')}
            actions={<Button variant="secondary" size="sm" icon={<Wallet />} disabled={ro} onClick={() => setNewPayment(true)}>{t('nav.newPayment')}</Button>} />
        ) : isMobile ? (
          <div className="bl-mlist">
            {payments.map(p => (
              <div key={p.id} className="bl-mcard" role="button" tabIndex={0} onClick={() => openReceipt(p.id)}>
                <div className="bl-mcard-main">
                  <div className="bl-mcard-title"><span className="bl-date">{fmtDate(p.date, lang)}</span></div>
                  <div className="bl-mcard-sub">{p.invoiceId && invNumber.get(p.invoiceId) ? <span className="num">{invNumber.get(p.invoiceId)!.number}</span> : t('billing.payments.onAccount')}</div>
                </div>
                <div className="bl-mcard-end"><Money value={p.amount} kind="signed" strong /><MethodBadge method={p.method} size="sm" /></div>
              </div>
            ))}
          </div>
        ) : (
          <DataTable className="bl-table bl-flat" columns={payColumns} rows={payments} rowKey={p => p.id} onRowClick={p => openReceipt(p.id)} />
        )}
      </Card>

      {newInvoice && <InvoiceFormModal open patientId={patientId} onClose={() => setNewInvoice(false)} onSaved={(inv, mode) => { if (mode === 'issue') navigate(`/invoices/${inv.id}`) }} />}
      <Suspense fallback={null}>{newPayment && <PaymentFormModal open patientId={patientId} onClose={() => setNewPayment(false)} />}</Suspense>
      {statement && <StatementModal patientId={patientId} onClose={() => setStatement(false)} />}
    </div>
  )
}
