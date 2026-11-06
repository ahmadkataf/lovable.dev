import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, ArrowUpDown, Check, ChevronDown, Eye, Pencil, Search, SearchX, SlidersHorizontal, Trash, UserPlus, Users, Wallet, X } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { Patient } from '@/db/types'
import { nowISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDebounced, useDoctors, useIsMobile, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Badge, Button, DataTable, EmptyState, Field, Input, Menu, Modal, PageHeader, Pagination, Segmented, Select, Skeleton, StatCard, Switch, usePagination, useToast, type Column, type MenuItemDef } from '@/ui'
import { dateOf, diffDays, fmtDate, relativeDay, today } from '@/lib/dates'
import {
  allTags, DEFAULT_FILTERS, filterPatients, hasActiveFilters, lastVisitsByPatient, latestOf, monthStartISO, patientStats, searchKey, sortPatients, SORTS,
  type GenderFilter, type PatientFilters, type PatientSort, type QuickFilter,
} from './lib'
import { ContactButtons, Fab, MedicalBadges, PatientAvatar, PhoneText, RowMenu, TagList, useGenderAge, usePlural } from './parts'
import { usePatientDelete } from './usePatientDelete'
import { useBalances } from './balances'

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
  const deletion = usePatientDelete()
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
  const [sheet, setSheet] = useState(false)          // phones: the filters and sort live in a bottom sheet

  const patients = useLiveQuery(() => db.patients.toArray(), [])
  const listed = patients !== undefined
  // exact balances of every patient: read after the list is on screen, in pages, and kept for the session
  const money$ = useBalances(listed)
  // Patient.lastVisit already holds every completed visit (kept by the appointments module); only patients who are in
  // the clinic right now (arrived / in treatment) are added. Two small index reads, never a cursor over every
  // appointment of the clinic's history (anyOf() walked ~50 000 rows one by one on each change).
  const visits = useLiveQuery(async () => {
    const [arrived, inChair] = await Promise.all([db.appointments.where('status').equals('arrived').toArray(), db.appointments.where('status').equals('in_progress').toArray()])
    return lastVisitsByPatient([...arrived, ...inChair])
  }, [])
  const balances = useMemo(() => money$ ?? new Map<string, number>(), [money$])
  const lastVisits = useMemo(() => visits ?? new Map<string, string>(), [visits])
  const monthStart = useMemo(() => monthStartISO(), [])

  const stats = useMemo(() => patientStats(patients ?? [], balances, monthStart), [patients, balances, monthStart])
  const tags = useMemo(() => allTags(patients ?? [], lang), [patients, lang])
  // search text normalized once per list, not once per patient per keystroke
  const searching = !!filters.q.trim()
  const keys = useMemo(() => (searching && patients ? new Map(patients.map(p => [p.id, searchKey(p)])) : undefined), [patients, searching])
  const rows = useMemo(() => sortPatients(filterPatients(patients ?? [], filters, { balances, monthStart, keys }), sort, { balances, lastVisits }, lang),
    [patients, filters, sort, balances, lastVisits, monthStart, lang, keys])
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
  const remove = (p: Patient) => deletion.remove(p)
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

  // a list filtered or sorted by balance waits for the balances; otherwise the list shows at once
  const loading = patients === undefined || ((filters.quick === 'balance' || sort === 'balance') && money$ === undefined)
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
  // phones: how many of the secondary filters (everything but the search box) are on, for the button badge
  const sheetCount = (filters.gender !== 'all' ? 1 : 0) + (filters.doctorId ? 1 : 0) + (filters.tag ? 1 : 0) + (filters.archived ? 1 : 0) + (sort !== 'recent' ? 1 : 0)
  const doctorSelect = doctors.length > 1 && (
    <Select className="pt-select" value={filters.doctorId} onChange={e => setFilters({ doctorId: e.target.value })} aria-label={t('patients.usualDoctor')}
      options={[{ value: '', label: t('patients.allDoctors') }, ...doctors.map(d => ({ value: d.id, label: d.name }))]} />
  )
  const tagSelect = tags.length > 0 && (
    <Select className="pt-select" value={filters.tag} onChange={e => setFilters({ tag: e.target.value })} aria-label={t('patients.tags')}
      options={[{ value: '', label: t('patients.allTags') }, ...tags.map(tg => ({ value: tg, label: tg }))]} />
  )
  const sortItems: MenuItemDef[] = [
    { header: t('sort') },
    ...SORTS.map(s => ({ label: t(`patients.sort.${s}`), icon: s === sort ? <Check /> : <span className="pt-menu-blank" />, onClick: () => setView(v => ({ ...v, sort: s })) })),
  ]

  return (
    <div className="page">
      <PageHeader
        title={t('patients.title')}
        subtitle={loading ? <Skeleton w={120} h={14} /> : filters.archived && !firstRun ? plural('archivedCount', archivedCount) : plural('count', stats.total)}
        actions={mobile ? undefined : newBtn}
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
          <StatCard tone="danger" icon={<Wallet />} label={t('patients.stat.withBalance')} value={loading || money$ === undefined ? <Skeleton w={48} h={24} /> : <span className="num">{stats.withBalance}</span>} onClick={() => setQuick('balance')} />
        </div>
      </div>

      <div className="pt-toolbar">
        <div className="pt-search">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('patients.searchPlaceholder')} iconStart={<Search />} clearable onClear={() => setQ('')} aria-label={t('search')} type="search" />
        </div>
        {mobile ? (
          // phones: one button instead of a sideways-scrolling row that hid the tags, archive and sort off-screen
          <Button className="pt-filter-btn" variant={sheetCount ? 'soft' : 'secondary'} icon={<SlidersHorizontal />} onClick={() => setSheet(true)} aria-label={t('patients.filters')} title={t('patients.filters')}>
            {sheetCount > 0 && <span className="pt-count"><span className="num">{sheetCount}</span></span>}
          </Button>
        ) : (
          <div className="pt-filters">
            <Segmented value={filters.gender} onChange={g => setFilters({ gender: g })} options={genderOptions} />
            {doctorSelect}
            {tagSelect}
            <Button variant={filters.archived ? 'soft' : 'secondary'} icon={<Archive />} onClick={() => setFilters({ archived: !filters.archived, quick: 'all' })} aria-pressed={filters.archived}>
              {t('patients.showArchived')}{archivedCount > 0 && <span className="pt-count"><span className="num">{archivedCount}</span></span>}
            </Button>
            <Menu items={sortItems} trigger={() => <Button icon={<ArrowUpDown />} iconEnd={<ChevronDown />} aria-label={t('sort')}>{t(`patients.sort.${sort}`)}</Button>} />
          </div>
        )}
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
      {deletion.dialog}
      {mobile && !firstRun && (
        // phones: the "new patient" action floats above the bottom bar instead of a full-width header button
        <Fab icon={<UserPlus />} label={t('patients.newPatient')} onClick={() => setForm({})} disabled={readOnly} title={readOnly ? t('trial.readonly') : undefined} />
      )}
      {mobile && sheet && (
        <Modal open onClose={() => setSheet(false)} size="sm" icon={<SlidersHorizontal />} title={t('patients.filters')}
          footer={<>
            <Button variant="ghost" icon={<X />} onClick={() => { setView(v => ({ filters: { ...DEFAULT_FILTERS, q: v.filters.q, quick: v.filters.quick }, sort: 'recent' })) }} disabled={!sheetCount}>{t('patients.clearFilters')}</Button>
            <Button variant="primary" onClick={() => setSheet(false)} data-autofocus>{loading ? t('close') : plural('showResults', rows.length)}</Button>
          </>}>
          <div className="col gap-4 pt-sheet">
            <Field label={t('gender')}><Segmented block value={filters.gender} onChange={g => setFilters({ gender: g })} options={genderOptions} /></Field>
            {doctors.length > 1 && <Field label={t('patients.usualDoctor')}>{doctorSelect}</Field>}
            {tags.length > 0 && <Field label={t('patients.tags')}>{tagSelect}</Field>}
            <Field label={t('sort')}>
              <Select value={sort} onChange={e => setView(v => ({ ...v, sort: e.target.value as PatientSort }))} options={SORTS.map(x => ({ value: x, label: t(`patients.sort.${x}`) }))} />
            </Field>
            <Switch checked={filters.archived} onChange={e => setFilters({ archived: e.target.checked, quick: 'all' })}
              label={<>{t('patients.showArchivedFull')}{archivedCount > 0 && <span className="pt-count"><span className="num">{archivedCount}</span></span>}</>} />
          </div>
        </Modal>
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
