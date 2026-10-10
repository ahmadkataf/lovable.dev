// /payments — the cash ledger: every payment in the period, filtered by method and by who received it,
// with receipts, deletion (which re-balances the invoice) and a printable cash report.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeftRight, Banknote, CreditCard, FileBarChart2, Plus, Printer, RotateCcw, Search, Trash2, Wallet } from 'lucide-react'
import { db, logActivity } from '@/db'
import { PAYMENT_METHODS, type Invoice, type Patient, type Payment, type PaymentMethod } from '@/db/types'
import { useI18n } from '@/i18n'
import { useDebounced, useIsMobile, useMoney, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { fmtDate } from '@/lib/dates'
import { matches } from '@/lib/format'
import { Avatar, Badge, Button, Chip, DataTable, EmptyState, IconButton, Input, PageHeader, Pagination, Select, Skeleton, StatCard, useConfirmDelete, usePagination, useToast, type Column } from '@/ui'
import { deletePayment } from './actions'
import { paymentStats } from './lib'
import { MethodBadge, Money, PeriodBar, usePeriod, ltr } from './shared'
import { openReceipt } from './Receipt'
import { CashReportModal } from './CashReport'
import './billing.css'

const PaymentFormModal = lazy(() => import('./PaymentFormModal'))

export interface LedgerRow extends Payment { patient?: Patient; invoice?: Invoice }

export default function PaymentsPage() {
  const { t, lang } = useI18n()
  const money = useMoney()
  const users = useUsers(false)
  const session = useSession()
  const license = useLicense()
  const isMobile = useIsMobile()
  const toast = useToast()
  const confirmDelete = useConfirmDelete()

  const [period, setPeriod] = usePeriod('payments', 'today')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [by, setBy] = useState('')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [adding, setAdding] = useState(false)
  const [report, setReport] = useState(false)

  const data = useLiveQuery(async () => {
    const list = await db.payments.where('date').between(period.from, period.to, true, true).toArray()
    const pids = [...new Set(list.map(p => p.patientId))]
    const iids = [...new Set(list.map(p => p.invoiceId).filter(Boolean) as string[])]
    const [pats, invs] = await Promise.all([db.patients.bulkGet(pids), db.invoices.bulkGet(iids)])
    const pm = new Map(pats.filter((p): p is Patient => !!p).map(p => [p.id, p]))
    const im = new Map(invs.filter((i): i is Invoice => !!i).map(i => [i.id, i]))
    const rows: LedgerRow[] = list.map(p => ({ ...p, patient: pm.get(p.patientId), invoice: p.invoiceId ? im.get(p.invoiceId) : undefined }))
    rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    return rows
  }, [period.from, period.to])
  const anyPayment = useLiveQuery(() => db.payments.limit(1).count(), [])

  const userName = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users])
  const receivers = useMemo(() => {
    const ids = new Set((data ?? []).map(p => p.receivedBy).filter(Boolean) as string[])
    return users.filter(u => ids.has(u.id) || u.active)
  }, [data, users])
  const base = useMemo(() => (data ?? []).filter(p => (!by || p.receivedBy === by) && (!dq || matches(`${p.patient?.name ?? ''} ${p.reference ?? ''} ${p.invoice?.number ?? ''}`, dq))), [data, by, dq])
  const stats = paymentStats(base)
  const rows = useMemo(() => (method ? base.filter(p => p.method === method) : base), [base, method])
  const methodsInUse = useMemo(() => PAYMENT_METHODS.filter(m => m === 'cash' || m === 'card' || m === 'transfer' || base.some(p => p.method === m)), [base])
  const pg = usePagination(rows, 25)
  useEffect(() => { pg.setPage(1) }, [method, by, dq, period.from, period.to]) // reset paging when the filters change

  const ro = license.readOnly
  const remove = async (p: LedgerRow) => {
    if (!(await confirmDelete(t('billing.payments.deleteDesc')))) return
    await deletePayment(p.id)
    void logActivity({ type: 'payment', action: 'delete', entityId: p.id, patientId: p.patientId, message: t('billing.act.paymentDeleted', { amount: ltr(money(p.amount)), patient: p.patient?.name ?? '' }), by: session.user?.id })
    toast.success(t('billing.payments.deleted'))
  }
  const rowActions = (p: LedgerRow) => (
    <span className="row gap-1" style={{ justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
      <IconButton label={t('billing.payment.printReceipt')} size="sm" variant="ghost" className="bl-menu-btn" onClick={() => openReceipt(p.id)}><Printer /></IconButton>
      <IconButton label={t('delete')} size="sm" variant="ghost" className="bl-menu-btn" disabled={ro} onClick={() => void remove(p)}><Trash2 /></IconButton>
    </span>
  )
  const invoiceCell = (p: LedgerRow) => p.invoice
    ? <Link className="bl-num-link num" to={`/invoices/${p.invoice.id}`} onClick={e => e.stopPropagation()}>{p.invoice.number}</Link>
    : <Badge tone="outline">{t('billing.payments.onAccount')}</Badge>

  const columns: Column<LedgerRow>[] = [
    { key: 'date', header: t('date'), render: p => <span className="bl-date">{fmtDate(p.date, lang)}</span> },
    {
      key: 'patient', header: t('patient'), render: p => (
        <div className="bl-patient-cell">
          <Avatar name={p.patient?.name ?? '?'} src={p.patient?.photo} size="xs" />
          {p.patient ? <Link className="bl-link truncate" to={`/patients/${p.patient.id}`} onClick={e => e.stopPropagation()}>{p.patient.name}</Link> : <span className="muted">{t('unknown')}</span>}
        </div>
      ),
    },
    { key: 'invoice', header: t('billing.invoice'), render: invoiceCell },
    { key: 'method', header: t('billing.method'), render: p => <span className="row gap-2"><MethodBadge method={p.method} />{p.amount < 0 && <Badge tone="warning" icon={<RotateCcw />}>{t('billing.payments.refund')}</Badge>}</span> },
    { key: 'amount', header: t('amount'), className: 'num', render: p => <Money value={p.amount} kind="signed" strong /> },
    { key: 'by', header: t('billing.payments.receivedBy'), hideBelow: 'lg', render: p => (p.receivedBy ? userName.get(p.receivedBy) ?? '—' : <span className="bl-dash">—</span>) },
    { key: 'ref', header: t('reference'), hideBelow: 'lg', render: p => (p.reference ? <span className="ltr truncate" style={{ maxWidth: 160, display: 'inline-block', verticalAlign: 'bottom' }}>{p.reference}</span> : <span className="bl-dash">—</span>) },
    { key: 'actions', header: '', className: 'actions', width: 96, render: rowActions },
  ]

  const newBtn = <Button variant="primary" icon={<Plus />} disabled={ro} title={ro ? t('trial.readonly') : undefined} onClick={() => setAdding(true)}>{t('nav.newPayment')}</Button>
  const loading = data === undefined
  const filtered = !!(method || by || dq)

  let body
  if (loading) body = <div className="card card-pad col gap-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="row gap-3"><Skeleton w={90} /><Skeleton w={28} h={28} r={14} /><Skeleton w="20%" /><div className="grow" /><Skeleton w={70} h={22} r={11} /><Skeleton w="10%" /></div>)}</div>
  else if (anyPayment === 0) body = <div className="card"><EmptyState icon={<Wallet />} title={t('billing.payments.emptyAll')} description={t('billing.payments.emptyDesc')} actions={newBtn} /></div>
  else if (rows.length === 0) {
    body = <div className="card"><EmptyState icon={<Search />} title={t('billing.payments.empty')} description={t('billing.noMatchDesc')} actions={filtered ? <Button onClick={() => { setMethod(''); setBy(''); setQ('') }}>{t('billing.clearFilters')}</Button> : newBtn} /></div>
  } else if (isMobile) {
    body = (
      <>
        <div className="bl-mlist">
          {pg.slice.map(p => (
            <div key={p.id} className="bl-mcard" role="button" tabIndex={0} onClick={() => openReceipt(p.id)} onKeyDown={e => { if (e.key === 'Enter') openReceipt(p.id) }}>
              <Avatar name={p.patient?.name ?? '?'} src={p.patient?.photo} size="sm" />
              <div className="bl-mcard-main">
                <div className="bl-mcard-title">{p.patient?.name ?? t('unknown')}</div>
                <div className="bl-mcard-sub"><span className="bl-date">{fmtDate(p.date, lang)}</span><span>·</span>{p.invoice ? <span className="num">{p.invoice.number}</span> : <span>{t('billing.payments.onAccount')}</span>}</div>
              </div>
              <div className="bl-mcard-end">
                <Money value={p.amount} kind="signed" strong />
                <MethodBadge method={p.method} size="sm" />
              </div>
            </div>
          ))}
        </div>
        <Pagination {...pg} />
      </>
    )
  } else {
    body = <DataTable className="bl-table" columns={columns} rows={pg.slice} rowKey={p => p.id} onRowClick={p => openReceipt(p.id)} footer={<Pagination {...pg} />} />
  }

  return (
    <div className="page">
      <PageHeader title={t('billing.payments.title')} subtitle={t('billing.payments.subtitle')}
        actions={<><Button variant="secondary" icon={<FileBarChart2 />} onClick={() => setReport(true)} disabled={loading}>{t('billing.payments.cashReport')}</Button>{newBtn}</>} />

      <PeriodBar value={period} onChange={setPeriod} />

      <div className="grid grid-stats bl-stats">
        <StatCard tone="primary" icon={<Wallet />} label={t('billing.payments.stat.net')} value={loading ? <Skeleton w={110} h={26} /> : <Money value={stats.net} />} sub={loading ? undefined : t('billing.payments.count', { n: stats.count })} />
        <StatCard tone="success" icon={<Banknote />} label={t('billing.payments.stat.cash')} value={loading ? <Skeleton w={110} h={26} /> : <Money value={stats.cash} />} />
        <StatCard tone="info" icon={<CreditCard />} label={t('billing.payments.stat.cardTransfer')} value={loading ? <Skeleton w={110} h={26} /> : <Money value={stats.cardTransfer} />} />
        <StatCard tone="warning" icon={<RotateCcw />} label={t('billing.payments.stat.refunds')} value={loading ? <Skeleton w={110} h={26} /> : <Money value={stats.refunds} />} />
      </div>

      {anyPayment !== 0 && <div className="bl-filters">
        <div className="bl-filters-row">
          <div className="bl-search"><Input value={q} onChange={e => setQ(e.target.value)} iconStart={<Search />} placeholder={t('billing.payments.search')} clearable onClear={() => setQ('')} aria-label={t('search')} /></div>
          <div className="bl-by">
            <Select value={by} onChange={e => setBy(e.target.value)} aria-label={t('billing.payments.receivedBy')}
              options={[{ value: '', label: t('billing.payments.allStaff') }, ...receivers.map(u => ({ value: u.id, label: u.name }))]} />
          </div>
        </div>
        <div className="bl-scroll-x">
          <div className="bl-chips">
            <Chip active={!method} onClick={() => setMethod('')} icon={<ArrowLeftRight />}>{t('billing.payments.allMethods')}</Chip>
            {methodsInUse.map(m => <Chip key={m} active={method === m} onClick={() => setMethod(method === m ? '' : m)}>{t(`pay.${m}`)}</Chip>)}
          </div>
        </div>
      </div>}

      {body}

      <Suspense fallback={null}>{adding && <PaymentFormModal open onClose={() => setAdding(false)} />}</Suspense>
      {report && data && <CashReportModal rows={rows} period={period} filters={{ method, by: by ? userName.get(by) : undefined }} onClose={() => setReport(false)} />}
    </div>
  )
}
