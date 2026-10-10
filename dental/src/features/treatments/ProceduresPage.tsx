import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronDown, Copy, DownloadCloud, EllipsisVertical, ListChecks, Pencil, Plus, Power, PowerOff, Search, SearchX, Sigma, Trash2 } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { Procedure, ProcedureCategory } from '@/db/types'
import { PROCEDURE_CATEGORIES } from '@/db/types'
import { useI18n } from '@/i18n'
import { useDebounced, useIsMobile, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import {
  Alert, Badge, Button, Card, Chip, DataTable, EmptyState, IconButton, Input, Menu, PageHeader, Segmented, Skeleton, Switch, useConfirm, useConfirmDelete, useToast, type Column,
} from '@/ui'
import { matches } from '@/lib/format'
import { CategoryBadge, CategoryDot, CATEGORY_COLOR } from './parts'
import { groupByCategory, sortProcedures, tn } from './lib'
import { deleteProcedure, loadDefaultCatalogue, procedureUsage, setProcedureActive } from './actions'
import ProcedureFormModal from './ProcedureFormModal'
import BulkPriceModal from './BulkPriceModal'
import './treatments.css'

type Show = 'all' | 'active' | 'inactive'

export default function ProceduresPage() {
  const { t, lang, pick } = useI18n()
  const money = useMoney()
  const mobile = useIsMobile()
  const toast = useToast()
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const { user, can } = useSession()
  const { readOnly: expired } = useLicense()
  // the price list is the clinic's to set: without the 'manage' permission it is read-only
  const readOnly = expired || !can('manage')

  const all = useLiveQuery(() => db.procedures.toArray(), [])
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [cat, setCat] = useState<ProcedureCategory | ''>('')
  const [show, setShow] = useState<Show>('all')
  const [collapsed, setCollapsed] = useState<Set<ProcedureCategory>>(new Set())
  const [form, setForm] = useState<{ open: boolean; procedure?: Procedure; copyOf?: Procedure }>({ open: false })
  const [bulk, setBulk] = useState(false)
  const [loadingDefaults, setLoadingDefaults] = useState(false)

  const list = all ?? []
  const counts = useMemo(() => {
    const m = new Map<ProcedureCategory, number>()
    for (const p of list) m.set(p.category, (m.get(p.category) ?? 0) + 1)
    return m
  }, [list])
  const activeCount = list.filter(p => p.active).length
  const filtered = useMemo(() => list.filter(p =>
    (!cat || p.category === cat)
    && (show === 'all' || (show === 'active' ? p.active : !p.active))
    && (!dq || matches(p.name, dq) || matches(p.nameEn, dq) || matches(p.code, dq))), [list, cat, show, dq])
  const groups = useMemo(() => groupByCategory(filtered), [filtered])
  const inCategory = useMemo(() => (cat ? list.filter(p => p.category === cat) : list), [list, cat])
  const usedCats = PROCEDURE_CATEGORIES.filter(c => counts.get(c))
  const searching = dq.trim().length > 0
  const hasFilter = searching || !!cat || show !== 'all'

  const loadDefaults = async () => {
    setLoadingDefaults(true)
    try {
      const n = await loadDefaultCatalogue()
      if (n > 0) {
        toast.success(t('treatments.toast.defaultsLoaded'), tn(t, lang, 'treatments.n.procedures', n))
        void logActivity({ type: 'system', action: 'create', by: user?.id, message: t('treatments.log.defaults', { n }) })
      } else toast.info(t('treatments.toast.defaultsNone'))
    } catch (e) { toast.error(t('error'), String((e as Error)?.message ?? e)) } finally { setLoadingDefaults(false) }
  }
  const toggleActive = async (p: Procedure, active = !p.active) => {
    await setProcedureActive(p.id, active)
    toast.success(t(active ? 'treatments.toast.procActivated' : 'treatments.toast.procDeactivated'), pick(p.name, p.nameEn))
  }
  const remove = async (p: Procedure) => {
    const used = await procedureUsage(p.id)
    if (used > 0) {
      const ok = await confirm({
        title: t('treatments.proc.inUseTitle'), description: t('treatments.proc.inUseDesc', { name: pick(p.name, p.nameEn), uses: tn(t, lang, 'treatments.n.uses', used) }),
        confirmLabel: p.active ? t('treatments.proc.deactivateInstead') : t('ok'), cancelLabel: t('cancel'), variant: 'primary',
      })
      if (ok && p.active) await toggleActive(p, false)
      return
    }
    if (!(await confirmDelete(t('treatments.proc.deleteDesc', { name: pick(p.name, p.nameEn) })))) return
    if (await deleteProcedure(p.id)) {
      toast.success(t('treatments.toast.procDeleted'), pick(p.name, p.nameEn))
      void logActivity({ type: 'system', action: 'delete', entityId: p.id, by: user?.id, message: t('treatments.log.procDeleted', { name: p.name }) })
    }
  }
  const toggleSection = (c: ProcedureCategory) => setCollapsed(s => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n })

  const rowMenu = (p: Procedure) => (
    <div className="tr-row-actions" onClick={e => e.stopPropagation()}>
      {!mobile && <IconButton variant="ghost" size="sm" label={t('edit')} disabled={readOnly} onClick={() => setForm({ open: true, procedure: p })}><Pencil /></IconButton>}
      <Menu trigger={() => <IconButton variant="ghost" size="sm" label={t('more')}><EllipsisVertical /></IconButton>} items={[
        ...(mobile ? [{ label: t('edit'), icon: <Pencil />, onClick: () => setForm({ open: true, procedure: p }), disabled: readOnly }] : []),
        { label: t('duplicate'), icon: <Copy />, onClick: () => setForm({ open: true, copyOf: p }), disabled: readOnly },
        { label: p.active ? t('treatments.proc.deactivate') : t('treatments.proc.activate'), icon: p.active ? <PowerOff /> : <Power />, onClick: () => void toggleActive(p), disabled: readOnly },
        { sep: true },
        { label: t('delete'), icon: <Trash2 />, danger: true, onClick: () => void remove(p), disabled: readOnly },
      ]} />
    </div>
  )

  const columns = (withCategory: boolean): Column<Procedure>[] => [
    { key: 'code', header: t('code'), width: 96, hideBelow: 'sm', render: p => p.code ? <span className="num tr-code">{p.code}</span> : <span className="muted">—</span> },
    {
      key: 'name', header: t('treatments.proc.name'), render: p => {
        const main = pick(p.name, p.nameEn), alt = pick(p.nameEn, p.name)
        return (
          <div className="tr-proc-name">
            <CategoryDot category={p.category} color={p.color} />
            <div className="grow">
              <div className="cell-main">{main}</div>
              <div className="cell-sub tr-proc-sub">
                {alt !== main && <span dir="auto" className="truncate">{alt}</span>}
                {mobile && p.code && <span className="num">{p.code}</span>}
                {mobile && p.durationMin ? <span><span className="num">{p.durationMin}</span> {t('min')}</span> : null}
                {!p.active && <Badge size="sm">{t('inactive')}</Badge>}
              </div>
            </div>
          </div>
        )
      },
    },
    ...(withCategory ? [{ key: 'category', header: t('category'), hideBelow: 'md' as const, render: (p: Procedure) => <CategoryBadge category={p.category} /> }] : []),
    { key: 'duration', header: t('duration'), hideBelow: 'md', width: 110, render: p => p.durationMin ? <span className="muted"><span className="num">{p.durationMin}</span> {t('min')}</span> : <span className="muted">—</span> },
    { key: 'tooth', header: t('treatments.proc.perTooth'), hideBelow: 'md', width: 96, className: 'tr-center', render: p => p.toothSpecific ? <span className="tr-yes" title={t('treatments.proc.toothSpecific')}><Check /></span> : <span className="muted">—</span> },
    { key: 'price', header: t('price'), className: 'num', width: 140, render: p => <span className="money tr-price">{money(p.price)}</span> },
    // a read-only list (expired trial, or no 'manage' permission) is a plain price list: no switches, no row menus
    ...(readOnly ? [] : [
      {
        key: 'active', header: t('active'), hideBelow: 'sm' as const, width: 84, render: (p: Procedure) => (
          <span onClick={e => e.stopPropagation()}><Switch checked={p.active} onChange={e => void toggleActive(p, e.target.checked)} aria-label={t('treatments.proc.activeLabel')} /></span>
        ),
      },
      { key: 'actions', header: <span className="sr-only">{t('actions')}</span>, className: 'actions', width: mobile ? 48 : 96, render: rowMenu },
    ]),
  ]

  const table = (rows: Procedure[], withCategory: boolean) => (
    <DataTable className="tr-flat-table" columns={columns(withCategory)} rows={sortProcedures(rows)} rowKey={p => p.id}
      onRowClick={readOnly ? undefined : p => setForm({ open: true, procedure: p })} rowClassName={p => (p.active ? undefined : 'tr-row-inactive')} />
  )

  const priceRange = (items: Procedure[]) => {
    const prices = items.map(p => p.price)
    const min = Math.min(...prices), max = Math.max(...prices)
    return min === max ? money(min) : `${money(min)} – ${money(max)}`
  }

  const loading = all === undefined
  const empty = !loading && list.length === 0

  return (
    <div className="page tr-page">
      <PageHeader title={t('treatments.proc.title')}
        subtitle={loading ? t('loading') : empty ? t('treatments.proc.subtitleEmpty') : t('treatments.proc.subtitle', { n: tn(t, lang, 'treatments.n.procedures', list.length), active: activeCount, cats: tn(t, lang, 'treatments.n.categories', usedCats.length) })}
        actions={<>
          {empty && <Button variant="secondary" icon={<DownloadCloud />} loading={loadingDefaults} disabled={readOnly} onClick={() => void loadDefaults()}>{t('treatments.proc.loadDefaults')}</Button>}
          {!empty && <Button variant="secondary" icon={<Sigma />} disabled={readOnly || loading} onClick={() => setBulk(true)}>{t('treatments.bulk.button')}</Button>}
          <Button variant="primary" icon={<Plus />} disabled={readOnly} onClick={() => setForm({ open: true })}>{t('treatments.proc.new')}</Button>
        </>} />
      {expired && <Alert tone="warning" className="mb-4">{t('trial.readonly')}</Alert>}

      {empty ? (
        <Card>
          <EmptyState icon={<ListChecks />} title={t('treatments.proc.emptyTitle')} description={t('treatments.proc.emptyDesc')}
            actions={!readOnly && <>
              <Button variant="primary" icon={<DownloadCloud />} loading={loadingDefaults} onClick={() => void loadDefaults()}>{t('treatments.proc.loadDefaults')}</Button>
              <Button variant="secondary" icon={<Plus />} onClick={() => setForm({ open: true })}>{t('treatments.proc.addOwn')}</Button>
            </>} />
        </Card>
      ) : (
        <>
          <Card className="tr-filters">
            <div className="tr-filter-row">
              <Input className="tr-search" iconStart={<Search />} placeholder={t('treatments.proc.search')} value={q} onChange={e => setQ(e.target.value)} clearable onClear={() => setQ('')} aria-label={t('search')} />
              <Segmented<Show> value={show} onChange={setShow} options={[
                { value: 'all', label: <>{t('all')} <span className="tr-seg-count">{list.length}</span></> },
                { value: 'active', label: <>{t('treatments.proc.showActive')} <span className="tr-seg-count">{activeCount}</span></> },
                { value: 'inactive', label: <>{t('treatments.proc.showInactive')} <span className="tr-seg-count">{list.length - activeCount}</span></> },
              ]} />
            </div>
            <div className="tr-chips-scroll tr-cat-chips">
              <Chip active={!cat} onClick={() => setCat('')}>{t('treatments.proc.allCategories')} <span className="tr-chip-count">{list.length}</span></Chip>
              {usedCats.map(c => (
                <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? '' : c)} icon={<CategoryDot category={c} />}>
                  {t(`cat.${c}`)} <span className="tr-chip-count">{counts.get(c)}</span>
                </Chip>
              ))}
            </div>
          </Card>

          {loading ? (
            <Card className="tr-section">
              <div className="card-body col gap-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="row gap-3"><Skeleton w={10} h={10} r={5} /><Skeleton w="40%" /><span className="grow" /><Skeleton w={80} /></div>)}</div>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState compact icon={<SearchX />} title={t('noResults')} description={t('treatments.proc.noMatch')}
                actions={hasFilter && <Button variant="secondary" onClick={() => { setQ(''); setCat(''); setShow('all') }}>{t('treatments.clearFilters')}</Button>} />
            </Card>
          ) : searching ? (
            <Card className="tr-section">
              <div className="tr-section-head static">
                <Search className="tr-section-icon" />
                <span className="tr-section-title">{t('treatments.proc.results')}</span>
                <Badge>{filtered.length}</Badge>
              </div>
              {table(filtered, true)}
            </Card>
          ) : (
            <div className="col gap-4">
              {groups.map(g => {
                const open = !collapsed.has(g.category)
                return (
                  <Card key={g.category} className="tr-section" style={{ ['--cat' as string]: CATEGORY_COLOR[g.category] }}>
                    <button type="button" className="tr-section-head" aria-expanded={open} onClick={() => toggleSection(g.category)}>
                      <span className="tr-section-mark" aria-hidden="true" />
                      <span className="tr-section-title">{t(`cat.${g.category}`)}</span>
                      <Badge>{g.items.length}</Badge>
                      <span className="grow" />
                      <span className="tr-section-range hide-mobile">{priceRange(g.items)}</span>
                      <ChevronDown className={`tr-chev${open ? ' open' : ''}`} />
                    </button>
                    {open && table(g.items, false)}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      <ProcedureFormModal open={form.open} onClose={() => setForm({ open: false })} procedure={form.procedure} copyOf={form.copyOf} defaultCategory={cat || undefined} all={list} />
      <BulkPriceModal open={bulk} onClose={() => setBulk(false)} procedures={inCategory} category={cat} />
    </div>
  )
}
