import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, ArrowUpDown, Check, ChevronDown, Eye, Pencil, Search, SearchX, Trash, UserPlus, Users, Wallet, X } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { Patient } from '@/db/types'
import { nowISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDebounced, useDoctors, useIsMobile, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Badge, Button, DataTable, EmptyState, Input, Menu, PageHeader, Pagination, Segmented, Select, Skeleton, StatCard, usePagination, useConfirmDelete, useToast, type Column, type MenuItemDef } from '@/ui'
import { dateOf, diffDays, fmtDate, relativeDay, today } from '@/lib/dates'
import {
  allTags, balancesByPatient, DEFAULT_FILTERS, filterPatients, hasActiveFilters, lastVisitsByPatient, latestOf, monthStartISO, patientStats, sortPatients, SORTS,
  type GenderFilter, type PatientFilters, type PatientSort, type QuickFilter,
} from './lib'
import { ContactButtons, MedicalBadges, PatientAvatar, PhoneText, RowMenu, TagList, useGenderAge, usePlural } from './parts'
import { deletePatientCascade } from './data'

const PatientFormModal = lazy(() => import('./PatientFormModal'))

const STATE_KEY = 'dentora.patients.view'
interface ViewState { filters: PatientFilters; sort: PatientSort }
function loadView(): ViewState {
  try {
    const v = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null')
    if (v && v.filters && SORTS.includes(v.sort)) return { filters: { ...DEFAULT_FILTERS, ...v.filters }, sort: v.sort }
  } catch { /* ignore */ }
  return { filters: DEFAULT_FILTERS, sort: 'recent' }
}

export default function PatientsPage() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const money = useMoney()
  const mobile = useIsMobile()
  const doctors = useDoctors()
  const session = useSession()
  const { readOnly } = useLicense()
  const toast = useToast()
  const confirmDelete = useConfirmDelete()
  const plural = usePlural()
  const genderAge = useGenderAge()

  const [view, setView] = useState<ViewState>(loadView)
  const { filters, sort } = view
  const [q, setQ] = useState(filters.q)
  const dq = useDebounced(q, 220)
  const setFilters = (patch: Partial<PatientFilters>) => setView(v => ({ ...v, filters: { ...v.filters, ...patch } }))
  useEffect(() => { setView(v => (v.filters.q === dq ? v : { ...v, filters: { ...v.filters, q: dq } })) }, [dq])
  useEffect(() => { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(view)) } catch { /* ignore */ } }, [view])

  const [form, setForm] = useState<{ patient?: Patient } | null>(null)

  const patients = useLiveQuery(() => db.patients.toArray(), [])
  const money$ = useLiveQuery(async () => {
    const [invoices, payments] = await Promise.all([db.invoices.toArray(), db.payments.toArray()])
    return balancesByPatient(invoices, payments)
  }, [])
  const visits = useLiveQuery(async () => lastVisitsByPatient(await db.appointments.where('status').anyOf('completed', 'arrived', 'in_progress').toArray()), [])
  const balances = useMemo(() => money$ ?? new Map<string, number>(), [money$])
  const lastVisits = useMemo(() => visits ?? new Map<string, string>(), [visits])
  const monthStart = useMemo(() => monthStartISO(), [])

  const stats = useMemo(() => patientStats(patients ?? [], balances, monthStart), [patients, balances, monthStart])
  const tags = useMemo(() => allTags(patients ?? [], lang), [patients, lang])
  const rows = useMemo(() => sortPatients(filterPatients(patients ?? [], filters, { balances, monthStart }), sort, { balances, lastVisits }, lang),
    [patients, filters, sort, balances, lastVisits, monthStart, lang])
  const archivedCount = useMemo(() => (patients ?? []).filter(p => p.archived).length, [patients])
  const pg = usePagination(rows, 25)
  useEffect(() => { pg.setPage(1) }, [filters, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const doctorName = (id?: string) => doctors.find(d => d.id === id)?.name
  const open = (p: Patient) => navigate(`/patients/${p.id}`)
  const canDelete = session.can('manage') && !readOnly

  const toggleArchive = async (p: Patient) => {
    await db.patients.update(p.id, { archived: !p.archived, updatedAt: nowISO() })
    void logActivity({ type: 'patient', action: 'status', entityId: p.id, patientId: p.id, message: `${p.name} — ${p.archived ? t('restore') : t('archive')}`, by: session.user?.id })
    toast.success(t(p.archived ? 'patients.restoredToast' : 'patients.archivedToast'), p.name)
  }
  const remove = async (p: Patient) => {
    if (!(await confirmDelete(t('patients.deleteConfirm')))) return
    try {
      await deletePatientCascade(p.id)
      void logActivity({ type: 'patient', action: 'delete', entityId: p.id, message: p.name, by: session.user?.id })
      toast.success(t('patients.deletedToast'), p.name)
    } catch {
      toast.error(t('patients.deleteFailed'))
    }
  }
  const rowItems = (p: Patient): MenuItemDef[] => [
    { label: t('open'), icon: <Eye />, onClick: () => open(p) },
    { label: t('edit'), icon: <Pencil />, onClick: () => setForm({ patient: p }), disabled: readOnly },
    { label: p.archived ? t('restore') : t('archive'), icon: p.archived ? <ArchiveRestore /> : <Archive />, onClick: () => void toggleArchive(p), disabled: readOnly },
    ...(session.can('manage') ? [{ sep: true }, { label: t('delete'), icon: <Trash />, danger: true, onClick: () => void remove(p), disabled: !canDelete }] : []),
  ]

  const visitCell = (p: Patient) => {
    const v = latestOf(p.lastVisit, lastVisits.get(p.id))
    if (!v) return <span className="subtle text-sm">{t('patients.noVisits')}</span>
    const d = dateOf(v)
    return <span className="text-sm pt-nowrap">{Math.abs(diffDays(d, today())) <= 1 ? relativeDay(d, lang) : fmtDate(d, lang)}</span>
  }
  const balanceCell = (p: Patient) => {
    const b = balances.get(p.id) ?? 0
    if (Math.abs(b) < 0.005) return <span className="subtle">—</span>
    return <span className={`money ${b > 0 ? 'neg' : 'pos'}`}>{money(b)}</span>
  }

  const columns: Column<Patient>[] = [
    { key: 'file', header: t('fileNo'), width: 80, render: p => <span className="pt-fileno num">#{p.fileNo}</span> },
    {
      key: 'patient', header: t('patients.col.patient'), render: p => (
        <div className="pt-person">
          <PatientAvatar patient={p} />
          <div className="grow">
            <div className="cell-main truncate">{p.name}</div>
            <div className="cell-sub truncate">{genderAge(p)}{p.doctorId && doctorName(p.doctorId) ? <> · <bdi>{doctorName(p.doctorId)}</bdi></> : null}</div>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: t('patients.col.phone'), className: 'pt-col-phone', render: p => <div className="pt-phone"><PhoneText phone={p.phone} /><ContactButtons phone={p.phone} /></div> },
    { key: 'medical', header: t('patients.col.medical'), className: 'pt-col-medical', render: p => <MedicalBadges patient={p} compact /> },
    { key: 'visit', header: t('patients.col.lastVisit'), className: 'pt-col-visit', render: visitCell },
    { key: 'balance', header: t('patients.col.balance'), className: 'num', render: balanceCell },
    { key: 'tags', header: t('patients.col.tags'), className: 'pt-col-tags', render: p => <TagList tags={p.tags} /> },
    { key: 'actions', header: <span className="sr-only">{t('actions')}</span>, className: 'actions', width: 56, render: p => <RowMenu items={rowItems(p)} label={t('actions')} /> },
  ]

  const loading = patients === undefined
  const firstRun = !loading && patients.length === 0
  const filtered = hasActiveFilters(filters)
  const clearAll = () => { setQ(''); setView(v => ({ ...v, filters: { ...DEFAULT_FILTERS, archived: v.filters.archived } })) }
  const newBtn = (
    <Button variant="primary" icon={<UserPlus />} onClick={() => setForm({})} disabled={readOnly} title={readOnly ? t('trial.readonly') : undefined}>{t('patients.newPatient')}</Button>
  )
  const empty = loading ? null
    : filtered ? <EmptyState icon={<SearchX />} title={t('patients.empty.search.title')} description={t('patients.empty.search.desc')} actions={<Button icon={<X />} onClick={clearAll}>{t('patients.clearFilters')}</Button>} />
    : filters.archived ? <EmptyState icon={<Archive />} title={t('patients.empty.archived.title')} description={t('patients.empty.archived.desc')} actions={<Button icon={<Users />} onClick={() => setFilters({ archived: false })}>{t('patients.backToActive')}</Button>} />
    : <EmptyState icon={<Users />} title={t('patients.empty.title')} description={t('patients.empty.desc')} actions={newBtn} />

  const setQuick = (k: QuickFilter) => setFilters({ quick: filters.quick === k ? 'all' : k, archived: false })
  const genderOptions: { value: GenderFilter; label: string }[] = [{ value: 'all', label: t('all') }, { value: 'male', label: t('male') }, { value: 'female', label: t('female') }]
  const sortItems: MenuItemDef[] = [
    { header: t('sort') },
    ...SORTS.map(s => ({ label: t(`patients.sort.${s}`), icon: s === sort ? <Check /> : <span className="pt-menu-blank" />, onClick: () => setView(v => ({ ...v, sort: s })) })),
  ]

  return (
    <div className="page">
      <PageHeader
        title={t('patients.title')}
        subtitle={loading ? <Skeleton w={120} h={14} /> : filters.archived && !firstRun ? plural('archivedCount', archivedCount) : plural('count', stats.total)}
        actions={newBtn}
      />

      {/* first run (no files at all, not even archived): only the welcome state, no filters */}
      {firstRun ? <div className="card pt-first-run"><EmptyState icon={<Users />} title={t('patients.empty.title')} description={t('patients.empty.desc')} actions={newBtn} /></div> : <>
      <div className="pt-stats">
        <div className="pt-stat">
          <StatCard tone="primary" icon={<Users />} label={t('patients.stat.total')} value={loading ? <Skeleton w={48} h={24} /> : <span className="num">{stats.total}</span>} onClick={() => setQuick('all')} />
        </div>
        <div className={`pt-stat${filters.quick === 'new' ? ' active' : ''}`}>
          <StatCard tone="success" icon={<UserPlus />} label={t('patients.stat.newMonth')} value={loading ? <Skeleton w={48} h={24} /> : <span className="num">{stats.newThisMonth}</span>} onClick={() => setQuick('new')} />
        </div>
        <div className={`pt-stat${filters.quick === 'balance' ? ' active' : ''}`}>
          <StatCard tone="danger" icon={<Wallet />} label={t('patients.stat.withBalance')} value={loading ? <Skeleton w={48} h={24} /> : <span className="num">{stats.withBalance}</span>} onClick={() => setQuick('balance')} />
        </div>
      </div>

      <div className="pt-toolbar">
        <div className="pt-search">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('patients.searchPlaceholder')} iconStart={<Search />} clearable onClear={() => setQ('')} aria-label={t('search')} type="search" />
        </div>
        <div className="pt-filters">
          <Segmented value={filters.gender} onChange={g => setFilters({ gender: g })} options={genderOptions} />
          {doctors.length > 1 && (
            <Select className="pt-select" value={filters.doctorId} onChange={e => setFilters({ doctorId: e.target.value })} aria-label={t('patients.usualDoctor')}
              options={[{ value: '', label: t('patients.allDoctors') }, ...doctors.map(d => ({ value: d.id, label: d.name }))]} />
          )}
          {tags.length > 0 && (
            <Select className="pt-select" value={filters.tag} onChange={e => setFilters({ tag: e.target.value })} aria-label={t('patients.tags')}
              options={[{ value: '', label: t('patients.allTags') }, ...tags.map(tg => ({ value: tg, label: tg }))]} />
          )}
          <Button variant={filters.archived ? 'soft' : 'secondary'} icon={<Archive />} onClick={() => setFilters({ archived: !filters.archived, quick: 'all' })} aria-pressed={filters.archived}>
            {t('patients.showArchived')}{archivedCount > 0 && <span className="pt-count"><span className="num">{archivedCount}</span></span>}
          </Button>
          <Menu items={sortItems} trigger={() => <Button icon={<ArrowUpDown />} iconEnd={<ChevronDown />} aria-label={t('sort')}>{t(`patients.sort.${sort}`)}</Button>} />
        </div>
      </div>

      {(filtered || filters.archived) && !loading && rows.length > 0 && (
        <div className="pt-resultbar">
          <span>{filters.archived ? <Badge icon={<Archive />}>{t('patients.archivedView')}</Badge> : null} <span className="num">{plural('results', rows.length)}</span></span>
          {filtered && <Button size="sm" variant="ghost" icon={<X />} onClick={clearAll}>{t('patients.clearFilters')}</Button>}
        </div>
      )}

      {loading ? <ListSkeleton mobile={mobile} />
        : mobile ? (
          rows.length === 0 ? <div className="card">{empty}</div> : (
            <>
              <div className="pt-cards">
                {pg.slice.map(p => (
                  <div key={p.id} className={`pt-card${p.archived ? ' archived' : ''}`} role="link" tabIndex={0} onClick={() => open(p)} onKeyDown={e => { if (e.key === 'Enter') open(p) }}>
                    <div className="pt-card-top">
                      <PatientAvatar patient={p} />
                      <div className="grow">
                        <div className="pt-card-name truncate">{p.name}</div>
                        <div className="pt-card-sub"><span className="num">#{p.fileNo}</span> · {genderAge(p)}</div>
                      </div>
                      {Math.abs(balances.get(p.id) ?? 0) >= 0.005 && <div className="pt-card-end">{balanceCell(p)}</div>}
                      <RowMenu items={rowItems(p)} label={t('actions')} />
                    </div>
                    {(p.phone || (p.allergies ?? []).length > 0 || (p.chronicDiseases ?? []).length > 0) && (
                      <div className="pt-card-bottom">
                        <div className="pt-phone"><PhoneText phone={p.phone} /><ContactButtons phone={p.phone} /></div>
                        <MedicalBadges patient={p} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-cards-footer"><Pagination {...pg} /></div>
            </>
          )
        ) : (
          <DataTable className="pt-table" columns={columns} rows={pg.slice} rowKey={p => p.id} onRowClick={open} empty={empty} rowClassName={p => (p.archived ? 'pt-row-archived' : undefined)}
            footer={<Pagination {...pg} />} />
        )}

      </>}

      {form && (
        <Suspense fallback={null}>
          <PatientFormModal open patient={form.patient} onClose={() => setForm(null)} onSaved={id => { if (!form.patient) navigate(`/patients/${id}`) }} />
        </Suspense>
      )}
    </div>
  )
}

function ListSkeleton({ mobile }: { mobile: boolean }) {
  const rows = Array.from({ length: mobile ? 5 : 7 })
  if (mobile) return <div className="pt-cards">{rows.map((_, i) => <div key={i} className="pt-card"><div className="pt-card-top"><Skeleton w={40} h={40} r={20} /><div className="grow col gap-2"><Skeleton w="60%" h={14} /><Skeleton w="40%" h={10} /></div></div></div>)}</div>
  return (
    <div className="table-wrap">
      {rows.map((_, i) => (
        <div key={i} className="pt-skel-row">
          <Skeleton w={52} h={22} r={8} /><Skeleton w={40} h={40} r={20} />
          <div className="grow col gap-2"><Skeleton w="30%" h={14} /><Skeleton w="18%" h={10} /></div>
          <Skeleton w={110} h={14} className="hide-mobile" /><Skeleton w={80} h={14} />
        </div>
      ))}
    </div>
  )
}
