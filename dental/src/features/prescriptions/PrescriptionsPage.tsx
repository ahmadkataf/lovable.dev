// /prescriptions — every prescription of the clinic (search, date presets, print, duplicate) and the drug catalogue.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, CalendarDays, ClipboardList, Copy, FilePlus2, Pill, Printer, Search, Trash2 } from 'lucide-react'
import { db } from '@/db'
import type { Patient, Prescription, User } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDebounced, useIsMobile, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Alert, Avatar, Button, Card, DataTable, EmptyState, IconButton, Input, PageHeader, Pagination, Segmented, Skeleton, Tabs, useConfirmDelete, usePagination, useToast, type Column } from '@/ui'
import { fmtDate, relativeDay } from '@/lib/dates'
import { DATE_PRESETS, duplicateDefaults, filterPrescriptions, itemsSummary, sortPrescriptions, type DatePreset } from './lib'
import { deletePrescription } from './actions'
import PrescriptionFormModal, { type RxFormDefaults } from './PrescriptionFormModal'
import RxSheetModal from './RxSheet'
import DrugsTab from './DrugsTab'
import { useElementWidth } from './parts'
import './prescriptions.css'

type TabId = 'prescriptions' | 'drugs'
type FormState = { prescription?: Prescription; defaults?: RxFormDefaults } | null

export default function PrescriptionsPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab: TabId = params.get('tab') === 'drugs' ? 'drugs' : 'prescriptions'
  const setTab = (id: TabId) => setParams(p => { const n = new URLSearchParams(p); if (id === 'prescriptions') n.delete('tab'); else n.set('tab', id); return n }, { replace: true })
  const { readOnly } = useLicense()
  const rxCount = useLiveQuery(() => db.prescriptions.count(), [])
  const drugCount = useLiveQuery(() => db.drugs.count(), [])
  const [form, setForm] = useState<FormState>(null)

  return (
    <div className="page rx-page">
      <PageHeader title={t('prescriptions.title')} subtitle={t('prescriptions.subtitle')}
        actions={!readOnly && <Button variant="primary" icon={<FilePlus2 />} onClick={() => setForm({})}>{t('prescriptions.new')}</Button>} />
      {readOnly && <Alert tone="warning" className="mb-4">{t('trial.readonly')}</Alert>}
      <div className="rx-tabs">
        <Tabs<TabId> value={tab} onChange={setTab} tabs={[
          { id: 'prescriptions', label: t('prescriptions.tab.list'), icon: <ClipboardList />, count: rxCount },
          { id: 'drugs', label: t('prescriptions.tab.drugs'), icon: <BookOpen />, count: drugCount },
        ]} />
      </div>
      {tab === 'prescriptions' ? <RxList onNew={() => setForm({})} onEdit={rx => setForm({ prescription: rx })} onDuplicate={rx => setForm({ defaults: duplicateDefaults(rx) })} /> : <DrugsTab />}
      {form && <PrescriptionFormModal open prescription={form.prescription} defaults={form.defaults} onClose={() => setForm(null)} />}
    </div>
  )
}

function RxList({ onNew, onEdit, onDuplicate }: { onNew: () => void; onEdit: (rx: Prescription) => void; onDuplicate: (rx: Prescription) => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const mobile = useIsMobile()
  const confirmDelete = useConfirmDelete()
  const session = useSession()
  const { readOnly } = useLicense()
  const users = useUsers(false)
  const today = todayISO()
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [preset, setPreset] = useState<DatePreset>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const list = useLiveQuery(() => db.prescriptions.toArray(), [])
  const patientIds = useMemo(() => [...new Set((list ?? []).map(p => p.patientId))], [list])
  const patients = useLiveQuery(async () => new Map((await db.patients.bulkGet(patientIds)).filter((p): p is Patient => !!p).map(p => [p.id, p])), [patientIds.join(',')])
  const userMap = useMemo(() => new Map<string, User>(users.map(u => [u.id, u])), [users])
  const rows = useMemo(() => sortPrescriptions(filterPrescriptions(list ?? [], { q: dq, preset, today, patients: patients ?? new Map() })), [list, dq, preset, today, patients])
  const pg = usePagination(rows, mobile ? 15 : 20)

  // the table when it fits the width the list really has (sidebar, font, long names), the card list otherwise
  const [listRef, listW] = useElementWidth()
  const listEl = useRef<HTMLDivElement | null>(null)
  const setList = useCallback((el: HTMLDivElement | null) => { listEl.current = el; listRef(el) }, [listRef])
  const [narrow, setNarrow] = useState(false)
  const fitFor = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (mobile) return
    if (fitFor.current !== listW) { fitFor.current = listW; if (narrow) { setNarrow(false); return } }
    if (narrow) return
    const wrap = listEl.current?.querySelector('.table-wrap')
    if (wrap && wrap.scrollWidth > wrap.clientWidth + 1) setNarrow(true)
  })
  const cards = mobile || narrow

  const remove = async (rx: Prescription) => {
    const name = patients?.get(rx.patientId)?.name ?? ''
    if (!(await confirmDelete(t('prescriptions.deleteDesc', { patient: name, date: fmtDate(rx.date, lang) })))) return
    await deletePrescription(rx, { by: session.user?.id, message: t('prescriptions.act.deleted', { patient: name }) })
    toast.success(t('prescriptions.toast.deleted'), name)
  }

  const summary = (rx: Prescription) => {
    const s = itemsSummary(rx.items)
    return (
      <div className="rx-sum">
        {s.names.map((n, i) => <span key={i} className="rx-sum-pill" dir="auto">{n}</span>)}
        {s.more > 0 && <span className="rx-sum-more num">+{s.more}</span>}
        {s.names.length === 0 && <span className="muted">—</span>}
      </div>
    )
  }
  const patientCell = (rx: Prescription) => {
    const p = patients?.get(rx.patientId)
    if (!p) return <span className="muted">{t('unknown')}</span>
    return (
      <Link to={`/patients/${p.id}?tab=prescriptions`} className="rx-patient-link" onClick={e => e.stopPropagation()}>
        <Avatar name={p.name} src={p.photo} size="sm" />
        <span style={{ minWidth: 0 }}><span className="cell-main truncate">{p.name}</span><span className="cell-sub num">#{p.fileNo}</span></span>
      </Link>
    )
  }
  const actions = (rx: Prescription) => (
    <div className="rx-actions" onClick={e => e.stopPropagation()}>
      <IconButton variant="ghost" size="sm" label={t('prescriptions.openPrint')} onClick={() => setOpenId(rx.id)}><Printer /></IconButton>
      {!readOnly && <IconButton variant="ghost" size="sm" label={t('prescriptions.duplicate')} onClick={() => onDuplicate(rx)}><Copy /></IconButton>}
      {!readOnly && <IconButton variant="ghost" size="sm" label={t('delete')} className="rx-del" onClick={() => void remove(rx)}><Trash2 /></IconButton>}
    </div>
  )
  const columns: Column<Prescription>[] = [
    { key: 'date', header: t('date'), render: rx => <div><div className="cell-main rx-nowrap">{fmtDate(rx.date, lang)}</div><div className="cell-sub">{relativeDay(rx.date, lang)}</div></div>, width: 150 },
    { key: 'patient', header: t('patient'), render: patientCell },
    { key: 'doctor', header: t('doctor'), render: rx => <span className="rx-nowrap text-sm">{userMap.get(rx.doctorId)?.name ?? '—'}</span>, hideBelow: 'lg' },
    { key: 'items', header: t('prescriptions.col.items'), render: rx => <div>{summary(rx)}{rx.diagnosis && <div className="cell-sub truncate rx-diag-sub rx-auto" dir="auto">{rx.diagnosis}</div>}</div> },
    { key: 'actions', header: <span className="sr-only">{t('actions')}</span>, render: actions, className: 'actions', width: 132 },
  ]

  const loading = list === undefined || patients === undefined
  if (!loading && list.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Pill />} title={t('prescriptions.empty.title')} description={t('prescriptions.empty.desc')}
          actions={!readOnly && <Button variant="primary" icon={<FilePlus2 />} onClick={onNew}>{t('prescriptions.new')}</Button>} />
      </Card>
    )
  }

  return (
    <>
      <div className="toolbar rx-toolbar">
        <div className="grow rx-search"><Input iconStart={<Search />} value={q} onChange={e => setQ(e.target.value)} placeholder={t('prescriptions.searchPh')} clearable onClear={() => setQ('')} /></div>
        <div className="rx-seg-scroll">
          <Segmented<DatePreset> value={preset} onChange={setPreset} options={DATE_PRESETS.map(p => ({ value: p, label: t(`prescriptions.preset.${p}`) }))} />
        </div>
      </div>
      <div ref={setList}>
      {loading ? (
        <div className="card card-pad col gap-3">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={48} />)}</div>
      ) : cards ? (
        <div className="card rx-mlist">
          {pg.slice.length === 0 ? <EmptyState compact icon={<Search />} title={t('noResults')} description={t('prescriptions.empty.filtered')} /> : pg.slice.map(rx => {
            const p = patients.get(rx.patientId)
            return (
              <div key={rx.id} className="rx-mcard" onClick={() => setOpenId(rx.id)}>
                <div className="rx-mcard-top">
                  <Avatar name={p?.name ?? '?'} src={p?.photo} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong truncate">{p?.name ?? t('unknown')}</div>
                    <div className="rx-mcard-sub"><CalendarDays size={12} /><span>{fmtDate(rx.date, lang)}</span><span className="truncate">· {userMap.get(rx.doctorId)?.name ?? '—'}</span></div>
                  </div>
                  {actions(rx)}
                </div>
                {summary(rx)}
              </div>
            )
          })}
          <Pagination {...pg} />
        </div>
      ) : (
        <DataTable columns={columns} rows={pg.slice} rowKey={rx => rx.id} onRowClick={rx => setOpenId(rx.id)}
          empty={<EmptyState compact icon={<Search />} title={t('noResults')} description={t('prescriptions.empty.filtered')} />} footer={<Pagination {...pg} />} />
      )}
      </div>
      {openId && <RxSheetModal id={openId} onClose={() => setOpenId(null)} onEdit={rx => { setOpenId(null); onEdit(rx) }} onDuplicate={rx => { setOpenId(null); onDuplicate(rx) }} />}
    </>
  )
}
