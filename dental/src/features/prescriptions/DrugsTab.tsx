// The drug catalogue: what the prescription form's typeahead offers, with the default regimen of each drug.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, DownloadCloud, Pencil, Pill, Plus, Search, Trash2 } from 'lucide-react'
import { db } from '@/db'
import type { Drug } from '@/db/types'
import { useI18n } from '@/i18n'
import { useDebounced, useIsMobile } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { Badge, Button, Card, DataTable, EmptyState, IconButton, Input, Pagination, Segmented, Skeleton, Switch, useConfirmDelete, usePagination, useToast, type Column } from '@/ui'
import { matches } from '@/lib/format'
import { seedDefaults } from '@/features/seed/demo'
import { usedValues } from '@/features/lab/lib'
import { regimenLine } from './lib'
import DrugFormModal from './DrugFormModal'

type ActiveFilter = 'all' | 'active' | 'inactive'

export default function DrugsTab() {
  const { t, pick } = useI18n()
  const toast = useToast()
  const mobile = useIsMobile()
  const confirmDelete = useConfirmDelete()
  const { readOnly } = useLicense()
  const drugs = useLiveQuery(() => db.drugs.toArray(), [])
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [filter, setFilter] = useState<ActiveFilter>('all')
  const [form, setForm] = useState<{ drug?: Drug } | null>(null)
  const [seeding, setSeeding] = useState(false)

  const sorted = useMemo(() => [...(drugs ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || pick(a.name, a.nameEn).localeCompare(pick(b.name, b.nameEn)) || (a.strength ?? '').localeCompare(b.strength ?? '', undefined, { numeric: true })), [drugs, pick])
  const counts = useMemo(() => ({ all: sorted.length, active: sorted.filter(d => d.active).length, inactive: sorted.filter(d => !d.active).length }), [sorted])
  const rows = useMemo(() => sorted.filter(d => (filter === 'all' || (filter === 'active') === d.active) && (!dq || [d.name, d.nameEn, d.form, d.strength].some(x => matches(x, dq)))), [sorted, filter, dq])
  const pg = usePagination(rows, mobile ? 15 : 20)
  const forms = useMemo(() => usedValues(drugs ?? [], d => d.form), [drugs])

  const loadDefaults = async () => {
    setSeeding(true)
    try {
      const r = await seedDefaults({ procedures: false, inventory: false })
      if (r.drugs) toast.success(t('prescriptions.drugs.loaded', { n: r.drugs }))
      else toast.info(t('prescriptions.drugs.notEmpty'))
    } catch { toast.error(t('error'), t('tryAgain')) } finally { setSeeding(false) }
  }
  const toggle = async (d: Drug, active: boolean) => {
    await db.drugs.update(d.id, { active })
    toast.success(t(active ? 'prescriptions.drugs.activated' : 'prescriptions.drugs.deactivated'), pick(d.name, d.nameEn))
  }
  const remove = async (d: Drug) => {
    if (!(await confirmDelete(t('prescriptions.drugs.deleteDesc', { name: pick(d.name, d.nameEn) })))) return
    await db.drugs.delete(d.id)
    toast.success(t('prescriptions.drugs.deleted'), pick(d.name, d.nameEn))
  }

  const actions = (d: Drug) => readOnly ? null : (
    <div className="rx-actions" onClick={e => e.stopPropagation()}>
      <IconButton variant="ghost" size="sm" label={t('edit')} onClick={() => setForm({ drug: d })}><Pencil /></IconButton>
      <IconButton variant="ghost" size="sm" label={t('delete')} className="rx-del" onClick={() => void remove(d)}><Trash2 /></IconButton>
    </div>
  )
  const nameCell = (d: Drug) => {
    const main = pick(d.name, d.nameEn), alt = main === d.name ? d.nameEn : d.name
    return <div className="rx-drug-cell"><span className="rx-drug-icon"><Pill /></span><div style={{ minWidth: 0 }}><div className="cell-main" dir="auto">{main}</div>{alt && alt !== main && <div className="cell-sub" dir="auto">{alt}</div>}</div></div>
  }
  const columns: Column<Drug>[] = [
    { key: 'name', header: t('prescriptions.drugs.name'), render: nameCell },
    { key: 'form', header: t('prescriptions.drugs.form'), render: d => (d.form ? <span className="rx-nowrap">{d.form}</span> : <span className="muted">—</span>), hideBelow: 'lg' },
    { key: 'strength', header: t('prescriptions.drugs.strength'), render: d => (d.strength ? <Badge tone="outline"><span dir="auto">{d.strength}</span></Badge> : <span className="muted">—</span>) },
    {
      key: 'defaults', header: t('prescriptions.drugs.defaults'), render: d => {
        const reg = regimenLine({ dose: d.defaultDose ?? '', frequency: d.defaultFrequency ?? '', duration: d.defaultDuration ?? '' }, ' · ')
        return reg || d.defaultInstructions ? <div className="rx-defaults"><div>{reg || '—'}</div>{d.defaultInstructions && <div className="cell-sub truncate">{d.defaultInstructions}</div>}</div> : <span className="muted">—</span>
      }, hideBelow: 'md',
    },
    { key: 'active', header: t('active'), render: d => <span onClick={e => e.stopPropagation()}><Switch checked={d.active} disabled={readOnly} onChange={e => void toggle(d, e.target.checked)} aria-label={t('active')} /></span>, width: 80 },
    { key: 'actions', header: <span className="sr-only">{t('actions')}</span>, render: actions, className: 'actions', width: 96 },
  ]

  const addBtn = !readOnly && <Button variant="primary" icon={<Plus />} onClick={() => setForm({})}>{t('prescriptions.drugs.add')}</Button>

  if (drugs === undefined) return <div className="card card-pad col gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} h={44} />)}</div>
  if (drugs.length === 0) {
    return (
      <Card>
        <EmptyState icon={<BookOpen />} title={t('prescriptions.drugs.emptyTitle')} description={t('prescriptions.drugs.emptyDesc')}
          actions={!readOnly && <>
            <Button variant="primary" icon={<DownloadCloud />} loading={seeding} onClick={() => void loadDefaults()}>{t('prescriptions.drugs.loadDefaults')}</Button>
            <Button variant="secondary" icon={<Plus />} onClick={() => setForm({})}>{t('prescriptions.drugs.add')}</Button>
          </>} />
        {form && <DrugFormModal drug={form.drug} forms={forms} onClose={() => setForm(null)} />}
      </Card>
    )
  }

  return (
    <>
      <div className="toolbar rx-toolbar">
        <div className="grow rx-search"><Input iconStart={<Search />} value={q} onChange={e => setQ(e.target.value)} placeholder={t('prescriptions.drugs.search')} clearable onClear={() => setQ('')} /></div>
        <Segmented<ActiveFilter> value={filter} onChange={setFilter} options={(['all', 'active', 'inactive'] as const).map(v => ({ value: v, label: <>{t(v)}<span className="rx-seg-count num">{counts[v]}</span></> }))} />
        {addBtn && <span className="rx-toolbar-add">{addBtn}</span>}
      </div>
      {mobile ? (
        <div className="card rx-mlist">
          {pg.slice.length === 0 ? <EmptyState compact icon={<Search />} title={t('noResults')} /> : pg.slice.map(d => (
            <div key={d.id} className={`rx-mcard${d.active ? '' : ' off'}`} onClick={readOnly ? undefined : () => setForm({ drug: d })}>
              <div className="rx-mcard-top">
                {nameCell(d)}
                <span onClick={e => e.stopPropagation()}><Switch checked={d.active} disabled={readOnly} onChange={e => void toggle(d, e.target.checked)} aria-label={t('active')} /></span>
              </div>
              <div className="rx-mcard-meta">
                {d.strength && <Badge tone="outline"><span dir="auto">{d.strength}</span></Badge>}
                {d.form && <span>{d.form}</span>}
                {d.defaultFrequency && <span>{d.defaultFrequency}</span>}
              </div>
            </div>
          ))}
          <Pagination {...pg} />
        </div>
      ) : (
        <DataTable columns={columns} rows={pg.slice} rowKey={d => d.id} onRowClick={readOnly ? undefined : d => setForm({ drug: d })} rowClassName={d => (d.active ? undefined : 'rx-row-off')}
          empty={<EmptyState compact icon={<Search />} title={t('noResults')} description={t('prescriptions.drugs.noMatch')} />} footer={<Pagination {...pg} />} />
      )}
      {form && <DrugFormModal drug={form.drug} forms={forms} onClose={() => setForm(null)} />}
    </>
  )
}
