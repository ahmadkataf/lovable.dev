// /payments — the cash ledger: one line per hand-over (receipt) in the period, filtered by method and by who received
// it, with receipts, deletion by the clinic admin (which re-balances the invoices) and a printable cash report.
// Only the rows on screen read their patient photos and invoice numbers; names come from the shared patient index.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeftRight, Banknote, CreditCard, FileBarChart2, Plus, Printer, RotateCcw, Search, Trash2, Wallet } from 'lucide-react'
import { db, logActivity } from '@/db'
import { PAYMENT_METHODS, type Invoice, type PaymentMethod } from '@/db/types'
import { useI18n } from '@/i18n'
import { useDebounced, useIsMobile, useMoney, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { fmtDate } from '@/lib/dates'
import { matches } from '@/lib/format'
import { Avatar, Badge, Button, Chip, DataTable, EmptyState, IconButton, Input, PageHeader, Pagination, Select, Skeleton, StatCard, useConfirmDelete, usePagination, useToast, type Column } from '@/ui'
import { BillingError, deleteReceipt, ensureReconciled } from './actions'
import { groupReceipts, paymentStats, pluralKey, type ReceiptGroup } from './lib'
import { usePagePatients, usePatientIndex } from './patientIndex'
import { useSnapshot } from './snapshot'
import { BillingGate, MethodBadge, Money, PeriodBar, usePeriod, iso } from './shared'
import { openReceipt } from './Receipt'
import { CashReportModal } from './CashReport'
import './billing.css'

const PaymentFormModal = lazy(() => import('./PaymentFormModal'))

export default function PaymentsPage() {
  return <BillingGate><PaymentsPageScreen /></BillingGate>
}

/**
 * Every invoice's number by id, read from the invoices' number index alone (no invoice records): what a search by
 * invoice number needs over a long period, without loading thousands of invoices. Nothing is read when off.
 */
function useAllInvoiceNumbers(enabled: boolean): Map<string, string> | undefined {
  return useLiveQuery(async () => {
    if (!enabled) return undefined
    const [numbers, ids] = await Promise.all([db.invoices.orderBy('number').keys(), db.invoices.orderBy('number').primaryKeys()])
    return new Map(ids.map((id, i) => [String(id), String(numbers[i])]))
  }, [enabled])
}

/** Invoice numbers of the given ids (the rows on screen). */
function useInvoiceNumbers(ids: string[]): Map<string, string> | undefined {
  const key = [...new Set(ids)].sort().join(',')
  const rows = useLiveQuery(async () => {
    const list = key ? key.split(',') : []
    const found = list.length ? await db.invoices.bulkGet(list) : []
    return new Map(found.filter((i): i is Invoice => !!i).map(i => [i.id, i.number]))
  }, [key])
  return rows
}

function PaymentsPageScreen() {
  const { t, lang } = useI18n()
  const money = useMoney()
  const users = useUsers(false)
  const session = useSession()
  const license = useLicense()
  const isMobile = useIsMobile()
  const toast = useToast()
  const confirmDelete = useConfirmDelete()

  const [period, setPeriod, rawPeriod] = usePeriod('payments', 'today')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [by, setBy] = useState('')
  const [q, setQ] = useState('')
  const dq = useDebounced(q).trim()
  // every patient's name is read only to search; the rows on screen read their own patients
  const patients = usePatientIndex(!!dq)
  const [adding, setAdding] = useState(false)
  const [report, setReport] = useState(false)

  // a plain read, refreshed right after any payment changes: a live query over years of payments costs a long freeze
  const list = useSnapshot(`${period.from}|${period.to}`, ['payments'], () => db.transaction('r', db.payments, () => db.payments.where('date').between(period.from, period.to, true, true).toArray()), 60)
  useEffect(() => { void ensureReconciled() }, [list])
  const anyPayment = useLiveQuery(() => db.payments.limit(1).count(), [])
  const groups = useMemo(() => (list ? groupReceipts(list) : undefined), [list])
  const invIds = (gs: ReceiptGroup[]) => gs.flatMap(g => g.allocations.map(a => a.invoiceId))

  const userName = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users])
  const receivers = useMemo(() => {
    const ids = new Set((groups ?? []).map(p => p.receivedBy).filter(Boolean) as string[])
    return users.filter(u => ids.has(u.id) || u.active)
  }, [groups, users])
  // searching by invoice number reads every number from the index; otherwise only the rows on screen read theirs
  const searchNumbers = useAllInvoiceNumbers(!!dq && /\d/.test(dq))
  const base = useMemo(() => (groups ?? []).filter(g => {
    if (by && g.receivedBy !== by) return false
    if (!dq) return true
    const p = patients?.byId.get(g.patientId)
    const numbers = g.allocations.map(a => searchNumbers?.get(a.invoiceId) ?? '').join(' ')
    return matches(`${p?.name ?? ''} ${p?.fileNo ?? ''} ${g.reference ?? ''} ${g.label} ${numbers}`, dq.replace(/^#/, ''))
  }), [groups, by, dq, patients, searchNumbers])
  const stats = paymentStats(base)
  const rows = useMemo(() => (method ? base.filter(p => p.method === method) : base), [base, method])
  const methodsInUse = useMemo(() => PAYMENT_METHODS.filter(m => m === 'cash' || m === 'card' || m === 'transfer' || base.some(p => p.method === m)), [base])
  const pg = usePagination(rows, 25)
  useEffect(() => { pg.setPage(1) }, [method, by, dq, period.from, period.to]) // reset paging when the filters change
  const numbers = useInvoiceNumbers(invIds(pg.slice))
  const pagePatients = usePagePatients(pg.slice.map(g => g.patientId))

  const ro = license.readOnly
  const canDelete = session.isAdmin && !ro
  const deleteTitle = ro ? t('trial.readonly') : !session.isAdmin ? t('billing.payments.adminOnly') : t('delete')
  const nameOf = (g: ReceiptGroup) => pagePatients?.get(g.patientId)?.name ?? patients?.byId.get(g.patientId)?.name
  const remove = async (g: ReceiptGroup) => {
    if (!canDelete) return
    if (!(await confirmDelete(t('billing.payments.deleteDesc', { receipt: iso(g.label), amount: iso(money(g.amount)) })))) return
    try {
      await deleteReceipt(g.lead.id, session.user?.id)
      void logActivity({ type: 'payment', action: 'delete', entityId: g.lead.id, patientId: g.patientId, message: t('billing.act.paymentDeleted', { amount: iso(money(g.amount)), patient: nameOf(g) ?? '', receipt: iso(g.label) }), by: session.user?.id })
      toast.success(t('billing.payments.deleted'))
    } catch (err) {
      toast.error(t('error'), err instanceof BillingError ? t(`billing.err.${err.code}`) : t('tryAgain'))
    }
  }
  const rowActions = (g: ReceiptGroup) => (
    <span className="row gap-1" style={{ justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
      <IconButton label={t('billing.payment.printReceipt')} size="sm" variant="ghost" className="bl-menu-btn" onClick={() => openReceipt(g.lead.id)}><Printer /></IconButton>
      <IconButton label={deleteTitle} title={deleteTitle} size="sm" variant="ghost" className="bl-menu-btn" disabled={!canDelete} onClick={() => void remove(g)}><Trash2 /></IconButton>
    </span>
  )
  const invoiceCell = (g: ReceiptGroup) => {
    if (!g.allocations.length) return <Badge tone="outline">{g.amount < 0 ? t('billing.payments.fromCredit') : t('billing.payments.onAccount')}</Badge>
    const shown = g.allocations.slice(0, 2), more = g.allocations.length - shown.length
    return (
      <span className="bl-inv-list" title={g.allocations.map(a => numbers?.get(a.invoiceId) ?? '').join(' · ')}>
        {shown.map(a => <Link key={a.invoiceId} className="bl-num-link num" to={`/invoices/${a.invoiceId}`} onClick={e => e.stopPropagation()}>{numbers?.get(a.invoiceId) ?? '…'}</Link>)}
        {more > 0 && <Badge tone="outline" size="sm"><span className="num">+{more}</span></Badge>}
        {Math.abs(g.onAccount) >= 0.0005 && <Badge tone="outline" size="sm">+ {t('billing.payments.onAccount')}</Badge>}
      </span>
    )
  }

  const columns: Column<ReceiptGroup>[] = [
    { key: 'date', header: t('date'), render: g => <span className="bl-date">{fmtDate(g.date, lang)}</span> },
    { key: 'receipt', header: t('billing.receipt.noShort'), className: 'bl-hide-1200', render: g => <span className={g.numbered ? 'num strong' : 'num muted'}>{g.label}</span> },
    {
      key: 'patient', header: t('patient'), render: g => (
        <div className="bl-patient-cell">
          <Avatar name={nameOf(g) ?? '?'} src={pagePatients?.get(g.patientId)?.photo} size="xs" />
          {nameOf(g) ? <Link className="bl-link" title={nameOf(g)} dir="auto" to={`/patients/${g.patientId}`} onClick={e => e.stopPropagation()}>{nameOf(g)}</Link> : <span className="muted">{pagePatients ? t('unknown') : '…'}</span>}
        </div>
      ),
    },
    { key: 'invoice', header: t('billing.invoice'), render: invoiceCell },
    { key: 'method', header: t('billing.method'), render: g => <span className="row gap-2"><MethodBadge method={g.method} />{g.amount < 0 && <Badge tone="warning" icon={<RotateCcw />}>{t('billing.payments.refund')}</Badge>}</span> },
    { key: 'amount', header: t('amount'), className: 'num', render: g => <Money value={g.amount} kind="signed" strong /> },
    { key: 'by', header: t('billing.payments.receivedBy'), className: 'bl-hide-1200', render: g => (g.receivedBy ? userName.get(g.receivedBy) ?? '—' : <span className="bl-dash">—</span>) },
    { key: 'ref', header: t('reference'), className: 'bl-hide-1440', render: g => (g.reference ? <span className="ltr truncate" style={{ maxWidth: 160, display: 'inline-block', verticalAlign: 'bottom' }}>{g.reference}</span> : <span className="bl-dash">—</span>) },
    { key: 'actions', header: '', className: 'actions', width: 96, render: rowActions },
  ]

  const newBtn = <Button variant="primary" icon={<Plus />} disabled={ro} title={ro ? t('trial.readonly') : undefined} onClick={() => setAdding(true)}>{t('nav.newPayment')}</Button>
  const loading = groups === undefined
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
          {pg.slice.map(g => (
            <div key={g.key} className="bl-mcard" role="button" tabIndex={0} onClick={() => openReceipt(g.lead.id)} onKeyDown={e => { if (e.key === 'Enter') openReceipt(g.lead.id) }}>
              <Avatar name={nameOf(g) ?? '?'} src={pagePatients?.get(g.patientId)?.photo} size="sm" />
              <div className="bl-mcard-main">
                <div className="bl-mcard-title" dir="auto">{nameOf(g) ?? (pagePatients ? t('unknown') : '…')}</div>
                <div className="bl-mcard-sub">
                  <span className="bl-date">{fmtDate(g.date, lang)}</span><span>·</span>
                  <span className="num">{g.label}</span><span>·</span>
                  {g.allocations.length ? <span className="num">{g.allocations.map(a => numbers?.get(a.invoiceId) ?? '…').join(' + ')}</span> : <span>{g.amount < 0 ? t('billing.payments.fromCredit') : t('billing.payments.onAccount')}</span>}
                </div>
              </div>
              <div className="bl-mcard-end">
                <Money value={g.amount} kind="signed" strong />
                <MethodBadge method={g.method} size="sm" />
              </div>
            </div>
          ))}
        </div>
        <Pagination {...pg} />
      </>
    )
  } else {
    body = <DataTable className="bl-table" columns={columns} rows={pg.slice} rowKey={g => g.key} onRowClick={g => openReceipt(g.lead.id)} footer={<Pagination {...pg} />} />
  }

  return (
    <div className="page">
      <PageHeader title={t('billing.payments.title')} subtitle={t('billing.payments.subtitle')}
        actions={<><Button variant="secondary" icon={<FileBarChart2 />} onClick={() => setReport(true)} disabled={loading}>{t('billing.payments.cashReport')}</Button>{newBtn}</>} />

      <PeriodBar value={rawPeriod} onChange={setPeriod} />

      <div className="grid grid-stats bl-stats">
        <StatCard tone="primary" icon={<Wallet />} label={t('billing.payments.stat.net')} value={loading ? <Skeleton w={110} h={26} /> : <Money value={stats.net} />} sub={loading ? undefined : t(pluralKey('billing.payments.count', stats.count, lang), { n: stats.count })} />
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
      {report && groups && <CashReportModal rows={rows} period={period} filters={{ method, by: by ? userName.get(by) : undefined }} onClose={() => setReport(false)} />}
    </div>
  )
}
