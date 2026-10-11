// /invoices — the invoice register: period cards, search, status and doctor filters, the list, and the invoice form.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Ban, CheckCircle2, Eye, FileText, Hourglass, MoreVertical, Plus, Printer, Receipt, Search, Trash2, Wallet } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { Invoice, Patient } from '@/db/types'
import { useI18n } from '@/i18n'
import { useDebounced, useDoctors, useIsMobile, useMoney, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { fmtDate } from '@/lib/dates'
import { Avatar, Button, Chip, DataTable, EmptyState, IconButton, Input, Menu, PageHeader, Pagination, Segmented, Skeleton, StatCard, useConfirm, useConfirmDelete, usePagination, useToast, type Column, type MenuItemDef } from '@/ui'
import { cancelInvoice, deleteDraftInvoice } from './actions'
import { filterInvoices, invoiceBalance, invoiceStats, isDraftNumber, isOpen, pluralKey, sortInvoices, statusCounts, type StatusFilter } from './lib'
import { BillingGate, Money, PeriodBar, StatusBadge, usePeriod, ltr, iso } from './shared'
import InvoiceFormModal from './InvoiceFormModal'
import './billing.css'

const PaymentFormModal = lazy(() => import('./PaymentFormModal'))
const STATUSES: StatusFilter[] = ['all', 'unpaid', 'partial', 'paid', 'draft', 'cancelled']

export default function InvoicesPage() {
  return <BillingGate><InvoicesPageScreen /></BillingGate>
}

function InvoicesPageScreen() {
  const { t, lang } = useI18n()
  const money = useMoney()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const license = useLicense()
  const session = useSession()
  const users = useUsers(false)
  const doctors = useDoctors()
  const isMobile = useIsMobile()
  const toast = useToast()
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()

  const [period, setPeriod, rawPeriod] = usePeriod('invoices')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [doctorId, setDoctorId] = useState('')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [form, setForm] = useState<{ patientId?: string; invoiceId?: string } | null>(null)
  const [payFor, setPayFor] = useState<Invoice | null>(null)

  // /invoices?patient=<id>&new=1 opens a new invoice for that patient
  useEffect(() => {
    if (params.get('new') === '1') {
      if (!license.readOnly) setForm({ patientId: params.get('patient') || undefined })
      setParams({}, { replace: true })
    }
  }, [params, setParams, license.readOnly])

  const data = useLiveQuery(async () => {
    const list = await db.invoices.where('date').between(period.from, period.to, true, true).toArray()
    const ids = [...new Set(list.map(i => i.patientId))]
    const pats = await db.patients.bulkGet(ids)
    return { list, patients: new Map(pats.filter((p): p is Patient => !!p).map(p => [p.id, p])) }
  }, [period.from, period.to])
  const anyInvoice = useLiveQuery(() => db.invoices.limit(1).count(), [])

  const userName = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users])
  const byDoctor = useMemo(() => (data ? data.list.filter(i => !doctorId || i.doctorId === doctorId) : []), [data, doctorId])
  const stats = invoiceStats(byDoctor)
  const searched = useMemo(() => (data ? filterInvoices(byDoctor, { q: dq }, data.patients) : []), [byDoctor, dq, data])
  const counts = statusCounts(searched)
  const rows = useMemo(() => sortInvoices(status === 'all' ? searched : searched.filter(i => i.status === status)), [searched, status])
  const pg = usePagination(rows, 25)
  useEffect(() => { pg.setPage(1) }, [status, doctorId, dq, period.from, period.to])

  const ro = license.readOnly
  const patientOf = (i: Invoice) => data?.patients.get(i.patientId)
  const numberOf = (i: Invoice) => (isDraftNumber(i.number) ? t('billing.draftNumber') : i.number)

  const doCancel = async (inv: Invoice) => {
    const desc = inv.paid > 0 ? `${t('billing.cancelInvoiceDesc')} ${t('billing.cancelWithPayments', { amount: ltr(money(inv.paid)) })}` : t('billing.cancelInvoiceDesc')
    if (!(await confirm({ title: `${t('billing.cancelInvoice')} ${inv.number}`, description: desc, danger: true, confirmLabel: t('billing.cancelInvoice'), cancelLabel: t('billing.keepInvoice') }))) return
    await cancelInvoice(inv.id)
    void logActivity({ type: 'invoice', action: 'status', entityId: inv.id, patientId: inv.patientId, message: t('billing.act.invoiceCancelled', { number: iso(inv.number), patient: patientOf(inv)?.name ?? '' }), by: session.user?.id })
    toast.success(t('billing.invoiceCancelled'))
  }
  const doDelete = async (inv: Invoice) => {
    if (!(await confirmDelete(t('billing.deleteDraftDesc')))) return
    await deleteDraftInvoice(inv.id)
    void logActivity({ type: 'invoice', action: 'delete', entityId: inv.id, patientId: inv.patientId, message: t('billing.act.invoiceDeleted', { patient: patientOf(inv)?.name ?? '' }), by: session.user?.id })
    toast.success(t('billing.invoiceDeleted'))
  }
  const menuItems = (inv: Invoice): MenuItemDef[] => [
    { label: t('billing.openInvoice'), icon: <Eye />, onClick: () => navigate(`/invoices/${inv.id}`) },
    { label: t('billing.recordPayment'), icon: <Wallet />, disabled: ro || !isOpen(inv), onClick: () => setPayFor(inv) },
    { label: t('billing.printInvoice'), icon: <Printer />, onClick: () => navigate(`/invoices/${inv.id}?print=1`) },
    ...(inv.status !== 'cancelled' && inv.status !== 'draft' ? [{ sep: true }, { label: t('billing.cancelInvoice'), icon: <Ban />, danger: true, disabled: ro, onClick: () => void doCancel(inv) }] : []),
    ...(inv.status === 'draft' ? [{ sep: true }, { label: t('billing.deleteDraft'), icon: <Trash2 />, danger: true, disabled: ro, onClick: () => void doDelete(inv) }] : []),
  ]
  const rowMenu = (inv: Invoice) => (
    <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      <Menu items={menuItems(inv)} trigger={() => <IconButton label={t('actions')} size="sm" variant="ghost" className="bl-menu-btn"><MoreVertical /></IconButton>} />
    </span>
  )

  const columns: Column<Invoice>[] = [
    {
      key: 'number', header: t('number'), render: i => (
        <div className="bl-num-cell">
          <span className={isDraftNumber(i.number) ? 'muted strong' : 'bl-num-link num'}>{numberOf(i)}</span>
          <div className="cell-sub bl-date bl-show-1200">{fmtDate(i.date, lang)}</div>
        </div>
      ),
    },
    { key: 'date', header: t('date'), className: 'bl-hide-1200', render: i => <span className="bl-date">{fmtDate(i.date, lang)}</span> },
    {
      key: 'patient', header: t('patient'), render: i => {
        const p = patientOf(i)
        return (
          <div className="bl-patient-cell">
            <Avatar name={p?.name ?? '?'} src={p?.photo} size="xs" />
            <div className="grow">
              {p ? <Link className="bl-link" title={p.name} to={`/patients/${p.id}`} onClick={e => e.stopPropagation()}>{p.name}</Link> : <span className="muted">{t('unknown')}</span>}
              {p && <div className="cell-sub">{t('fileNo')} <span className="num">{p.fileNo}</span></div>}
            </div>
          </div>
        )
      },
    },
    { key: 'doctor', header: t('doctor'), className: 'bl-hide-1200', render: i => (i.doctorId ? userName.get(i.doctorId) ?? '—' : <span className="bl-dash">—</span>) },
    { key: 'total', header: t('total'), className: 'num', render: i => <Money value={i.total} strong /> },
    { key: 'paid', header: t('paid'), className: 'num bl-hide-1440', render: i => (i.status === 'draft' ? <span className="bl-dash">—</span> : <Money value={i.paid} kind="muted" />) },
    { key: 'due', header: t('due'), className: 'num', render: i => (i.status === 'draft' || i.status === 'cancelled' ? <span className="bl-dash">—</span> : <Money value={invoiceBalance(i)} kind="due" />) },
    { key: 'status', header: t('status'), render: i => <StatusBadge status={i.status} /> },
    { key: 'actions', header: '', className: 'actions', width: 56, render: rowMenu },
  ]

  const newBtn = <Button variant="primary" icon={<Plus />} disabled={ro} title={ro ? t('trial.readonly') : undefined} onClick={() => setForm({})}>{t('billing.newInvoice')}</Button>
  const loading = data === undefined
  const filtered = !!(dq || status !== 'all' || doctorId)
  const clearFilters = () => { setQ(''); setStatus('all'); setDoctorId('') }

  let body
  if (loading) body = <ListSkeleton />
  else if (anyInvoice === 0) {
    body = <div className="card"><EmptyState icon={<Receipt />} title={t('billing.empty.title')} description={t('billing.empty.desc')} actions={newBtn} /></div>
  } else if (rows.length === 0) {
    body = <div className="card"><EmptyState icon={<Search />} title={t('billing.noMatch')} description={t('billing.noMatchDesc')} actions={filtered ? <Button onClick={clearFilters}>{t('billing.clearFilters')}</Button> : newBtn} /></div>
  } else if (isMobile) {
    body = (
      <>
        <div className="bl-mlist">
          {pg.slice.map(i => {
            const p = patientOf(i)
            const due = invoiceBalance(i)
            return (
              <div key={i.id} className="bl-mcard" role="button" tabIndex={0} onClick={() => navigate(`/invoices/${i.id}`)} onKeyDown={e => { if (e.key === 'Enter') navigate(`/invoices/${i.id}`) }}>
                <Avatar name={p?.name ?? '?'} src={p?.photo} size="sm" />
                <div className="bl-mcard-main">
                  <div className="bl-mcard-title">{p?.name ?? t('unknown')}</div>
                  <div className="bl-mcard-sub"><span className={isDraftNumber(i.number) ? '' : 'num'}>{numberOf(i)}</span><span>·</span><span className="bl-date">{fmtDate(i.date, lang)}</span></div>
                </div>
                <div className="bl-mcard-end">
                  <Money value={i.total} strong />
                  {due > 0 ? <span className="text-xs"><Money value={due} kind="due" /></span> : <StatusBadge status={i.status} size="sm" />}
                </div>
                {rowMenu(i)}
              </div>
            )
          })}
        </div>
        <Pagination {...pg} />
      </>
    )
  } else {
    body = <DataTable className="bl-table" columns={columns} rows={pg.slice} rowKey={i => i.id} onRowClick={i => navigate(`/invoices/${i.id}`)}
      rowClassName={i => (i.status === 'cancelled' ? 'bl-row-muted' : undefined)} footer={<Pagination {...pg} />} />
  }

  return (
    <div className="page">
      <PageHeader title={t('billing.title')} subtitle={t('billing.subtitle')}
        actions={<><Button variant="secondary" icon={<Wallet />} to="/payments" className="hide-mobile">{t('nav.payments')}</Button>{newBtn}</>} />

      <PeriodBar value={rawPeriod} onChange={setPeriod} />

      <div className="grid grid-stats bl-stats">
        <StatCard tone="primary" icon={<FileText />} label={t('billing.stat.invoiced')} value={loading ? <Skeleton w={110} h={26} /> : <Money value={stats.invoiced} />} />
        <StatCard tone="success" icon={<CheckCircle2 />} label={t('billing.stat.collected')} value={loading ? <Skeleton w={110} h={26} /> : <Money value={stats.collected} />} />
        <StatCard tone="danger" icon={<Hourglass />} label={t('billing.stat.outstanding')} value={loading ? <Skeleton w={110} h={26} /> : <Money value={stats.outstanding} />} />
        <StatCard tone="info" icon={<Receipt />} label={t('billing.stat.count')} value={loading ? <Skeleton w={50} h={26} /> : <span className="num">{stats.count}</span>}
          sub={stats.drafts > 0 ? t(pluralKey('billing.draftsCount', stats.drafts, lang), { n: stats.drafts }) : undefined} />
      </div>

      {anyInvoice !== 0 && <div className="bl-filters">
        <div className="bl-filters-row">
          <div className="bl-search"><Input value={q} onChange={e => setQ(e.target.value)} iconStart={<Search />} placeholder={t('billing.searchInvoices')} clearable onClear={() => setQ('')} aria-label={t('search')} /></div>
          <div className="bl-scroll-x">
            <Segmented<StatusFilter> value={status} onChange={setStatus}
              options={STATUSES.map(s => ({ value: s, label: <>{s === 'all' ? t('all') : t(`inv.${s}`)}<span className="bl-count num">{counts[s]}</span></> }))} />
          </div>
        </div>
        {doctors.length > 1 && (
          <div className="bl-scroll-x">
            <div className="bl-chips">
              <Chip active={!doctorId} onClick={() => setDoctorId('')}>{t('billing.allDoctors')}</Chip>
              {doctors.map(d => <Chip key={d.id} active={doctorId === d.id} onClick={() => setDoctorId(doctorId === d.id ? '' : d.id)} icon={<span className="bl-chip-dot" style={{ background: d.color }} />}>{d.name}</Chip>)}
            </div>
          </div>
        )}
      </div>}

      {body}

      {form && (
        <InvoiceFormModal open patientId={form.patientId} invoiceId={form.invoiceId} onClose={() => setForm(null)}
          onSaved={(inv, mode) => { if (mode === 'issue') navigate(`/invoices/${inv.id}`) }} />
      )}
      <Suspense fallback={null}>
        {payFor && <PaymentFormModal open patientId={payFor.patientId} invoiceId={payFor.id} onClose={() => setPayFor(null)} />}
      </Suspense>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="card card-pad col gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="row gap-3"><Skeleton w={28} h={28} r={14} /><Skeleton w="22%" /><Skeleton w="14%" /><div className="grow" /><Skeleton w="12%" /><Skeleton w={70} h={22} r={11} /></div>
      ))}
    </div>
  )
}
