import { useCallback, useMemo, useState, type MouseEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Boxes, CalendarClock, Coins, Download, Eye, History, Minus, PackagePlus, Pencil, Plus, Power, PowerOff, Search, ShieldAlert, ShoppingCart, Trash2, TriangleAlert, X,
} from 'lucide-react'
import { db, logActivity } from '@/db'
import { todayISO } from '@/db/ids'
import type { InventoryItem, StockMovement } from '@/db/types'
import {
  Alert, Badge, Button, Card, Chip, DataTable, EmptyState, Input, PageHeader, Pagination, Skeleton, StatCard, Switch, Tabs, useConfirm, useToast, usePagination,
  type Column, type MenuItemDef,
} from '@/ui'
import { useI18n } from '@/i18n'
import { useDebounced, useIsMobile, useMoney, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { fmtTime } from '@/lib/dates'
import { matches } from '@/lib/format'
import { saveText } from '@/platform'
import {
  CATEGORY_PRESETS, customCategories, expiryState, filterItems, inventoryStats, isLowStock, isOutOfStock, itemValue, sortItems, sortMovements, toCSV, type MoveDirection,
} from './lib'
import { deleteItem, hasRealMovements, setItemActive } from './actions'
import { CategoryBadge, ExpiryBadge, StockBadge, catLabel, qtyText, reasonLabel, unitLabel, useUnitMoney } from './parts'
import ItemFormModal from './ItemFormModal'
import PurchaseModal from './PurchaseModal'
import MovementsDrawer from './MovementsDrawer'
import MovementsTab from './MovementsTab'
import { QuickMovePopover } from './QuickMove'
import { RowMenu } from './RowMenu'
import { tn } from './plural'
import './inventory.css'

type TabId = 'items' | 'movements'

/** Stock is for roles with the 'inventory' permission: the menu hides the page from others, and a typed URL lands here. */
export default function InventoryPage() {
  const { t } = useI18n()
  const session = useSession()
  if (!session.can('inventory')) {
    return (
      <div className="page">
        <Card><EmptyState icon={<ShieldAlert />} title={t('inventory.noPermission')} description={t('inventory.noPermissionSub')} actions={<Button variant="primary" to="/">{t('inventory.backHome')}</Button>} /></Card>
      </div>
    )
  }
  return <InventoryView />
}

function InventoryView() {
  const { t, lang } = useI18n()
  const money = useMoney()
  const unitMoney = useUnitMoney()
  const mobile = useIsMobile()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useSession()
  const { readOnly } = useLicense()
  const users = useUsers(false)
  const today = todayISO()

  const items = useLiveQuery(() => db.inventory.toArray(), [])
  const movementCount = useLiveQuery(() => db.stock.count(), [])
  // items with history beyond their opening stock: those are deactivated, not deleted (the menu hides "delete")
  const withHistory = useLiveQuery(async () => new Set((await db.stock.where('reason').noneOf(['initial']).toArray()).map(m => m.itemId)), [])
  const [tab, setTab] = useState<TabId>('items')
  const movements = useLiveQuery<StockMovement[] | undefined>(async () => (tab === 'movements' ? db.stock.toArray() : undefined), [tab])

  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [category, setCategory] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const [form, setForm] = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [purchase, setPurchase] = useState<{ open: boolean; ids?: string[] }>({ open: false })
  const [move, setMove] = useState<{ id: string; dir: MoveDirection; anchor: HTMLElement } | null>(null)

  const stats = useMemo(() => (items ? inventoryStats(items, today) : null), [items, today])
  const categories = useMemo(() => {
    if (!items) return []
    const used = new Map<string, number>()
    for (const i of items) if (i.active || showInactive) used.set(i.category, (used.get(i.category) ?? 0) + 1)
    const presets = CATEGORY_PRESETS.filter(c => used.has(c))
    return [...presets, ...customCategories(items).filter(c => used.has(c))].map(c => ({ value: c, count: used.get(c) ?? 0 }))
  }, [items, showInactive])
  const rows = useMemo(() => {
    if (!items) return []
    let list = filterItems(items, { q: dq, category, lowOnly, showInactive }, matches)
    if (expiringOnly) list = list.filter(i => { const s = expiryState(i.expiryDate, today); return s === 'soon' || s === 'expired' })
    return sortItems(list, today)
  }, [items, dq, category, lowOnly, expiringOnly, showInactive, today])
  const pg = usePagination(rows, 25)
  const lowItems = useMemo(() => (items ?? []).filter(i => i.active && isLowStock(i)), [items])
  const filtered = !!(dq || category || lowOnly || expiringOnly)
  const clearFilters = () => { setQ(''); setCategory(''); setLowOnly(false); setExpiringOnly(false) }

  const moveItem = move ? items?.find(i => i.id === move.id) : undefined
  const openMove = (e: MouseEvent<HTMLElement>, id: string, dir: MoveDirection) => {
    e.stopPropagation()
    const anchor = e.currentTarget
    setMove(m => (m && m.id === id && m.dir === dir ? null : { id, dir, anchor }))
  }
  const closeMove = useCallback(() => setMove(null), [])

  const toggleActive = async (it: InventoryItem) => {
    await setItemActive(it.id, !it.active)
    toast.success(it.active ? t('inventory.toast.deactivated') : t('inventory.toast.activated'), <bdi className="inv-wrap">{it.name}</bdi>)
    void logActivity({ type: 'inventory', action: 'status', entityId: it.id, by: user?.id, message: t('inventory.act.status', { name: it.name, status: it.active ? t('inactive') : t('active') }) })
  }
  const remove = async (it: InventoryItem) => {
    if (await hasRealMovements(it.id)) {
      const ok = await confirm({ title: t('inventory.deleteItem'), description: t('inventory.cantDelete'), confirmLabel: t('inventory.deactivate'), variant: 'primary' })
      if (ok && it.active) await toggleActive(it)
      return
    }
    const ok = await confirm({ title: t('confirmDeleteTitle'), description: <span className="inv-wrap">{t('inventory.deleteDesc', { name: it.name })}</span>, danger: true })
    if (!ok) return
    try {
      await deleteItem(it.id)
      toast.success(t('inventory.toast.deleted'), <bdi className="inv-wrap">{it.name}</bdi>)
      void logActivity({ type: 'inventory', action: 'delete', entityId: it.id, by: user?.id, message: t('inventory.act.deleted', { name: it.name }) })
    } catch { toast.error(t('error')) }
  }

  const menuFor = (it: InventoryItem): MenuItemDef[] => [
    { label: t('inventory.history'), icon: <History />, onClick: () => setHistoryId(it.id) },
    ...(readOnly ? [] : [
      { label: t('edit'), icon: <Pencil />, onClick: () => setForm({ open: true, item: it }) },
      ...(it.active ? [{ label: t('inventory.purchaseItem'), icon: <ShoppingCart />, onClick: () => setPurchase({ open: true, ids: [it.id] }) }] : []),
      { label: it.active ? t('inventory.deactivate') : t('inventory.activate'), icon: it.active ? <PowerOff /> : <Power />, onClick: () => void toggleActive(it) },
      ...(withHistory && !withHistory.has(it.id) ? [
        { sep: true },
        { label: t('inventory.deleteItem'), icon: <Trash2 />, danger: true, onClick: () => void remove(it) },
      ] : []),
    ] as MenuItemDef[]),
  ]

  const exportCsv = async () => {
    const date = today
    let saved = false
    if (tab === 'movements') {
      const list = sortMovements(movements ?? (await db.stock.toArray()))
      const byId = new Map((items ?? []).map(i => [i.id, i]))
      const data = [[t('inventory.col.date'), t('time'), t('inventory.col.item'), t('inventory.col.reason'), t('inventory.col.delta'), t('inventory.field.unit'), t('inventory.col.note'), t('inventory.col.by')],
        ...list.map(m => [m.date, fmtTime(m.createdAt, lang), byId.get(m.itemId)?.name ?? '', reasonLabel(t, m.reason), m.delta, byId.get(m.itemId) ? unitLabel(t, byId.get(m.itemId)!.unit) : '', m.note ?? '', users.find(u => u.id === m.by)?.name ?? ''])]
      saved = await saveText(`stock-movements-${date}.csv`, toCSV(data), 'text/csv;charset=utf-8')
    } else {
      const data = [[t('inventory.col.item'), t('inventory.field.sku'), t('inventory.field.category'), t('inventory.field.unit'), t('inventory.col.quantity'), t('inventory.col.min'), t('inventory.col.cost'), t('inventory.col.value'), t('inventory.col.supplier'), t('inventory.col.expiry'), t('inventory.col.location'), t('status')],
        ...rows.map(i => [i.name, i.sku ?? '', catLabel(t, i.category), unitLabel(t, i.unit), i.quantity, i.minQuantity, i.costPrice ?? '', itemValue(i), i.supplier ?? '', i.expiryDate ?? '', i.location ?? '', i.active ? t('active') : t('inactive')])]
      saved = await saveText(`inventory-${date}.csv`, toCSV(data), 'text/csv;charset=utf-8')
    }
    if (saved) toast.success(t('inventory.toast.exported'))
  }

  // ---- cells ----
  const qtyCell = (it: InventoryItem, big = false) => {
    const low = it.active && isLowStock(it)
    return (
      <div className={`inv-qty${big ? ' big' : ''}`}>
        {!readOnly && it.active && <button type="button" className="inv-step" aria-label={t('inventory.move.remove')} title={t('inventory.move.remove')} disabled={it.quantity <= 0} onClick={e => openMove(e, it.id, 'out')}><Minus /></button>}
        <div className="inv-qty-val">
          <span className={`inv-qty-num num${low ? ' low' : ''}`}>{qtyText(it.quantity, lang)}</span>
          <span className="inv-qty-unit">{unitLabel(t, it.unit)}</span>
        </div>
        {!readOnly && it.active && <button type="button" className="inv-step add" aria-label={t('inventory.move.add')} title={t('inventory.move.add')} onClick={e => openMove(e, it.id, 'in')}><Plus /></button>}
      </div>
    )
  }
  const itemCell = (it: InventoryItem) => (
    <div className="inv-item-cell">
      <div className="cell-main inv-item-name"><bdi>{it.name}</bdi>{!it.active && <Badge size="sm">{t('inventory.inactive')}</Badge>}</div>
      <div className="inv-item-meta">
        {it.sku && <span className="inv-sku ltr">{it.sku}</span>}
        <CategoryBadge category={it.category} />
        {it.active && <StockBadge item={it} />}
      </div>
    </div>
  )
  const columns: Column<InventoryItem>[] = [
    { key: 'item', header: t('inventory.col.item'), render: itemCell },
    { key: 'qty', header: t('inventory.col.quantity'), render: it => qtyCell(it), width: 170 },
    { key: 'min', header: t('inventory.col.min'), render: it => <span className="num muted">{qtyText(it.minQuantity, lang)}</span>, hideBelow: 'lg', className: 'num' },
    { key: 'cost', header: t('inventory.col.cost'), render: it => (it.costPrice ? <span className="money inv-money">{unitMoney(it.costPrice)}</span> : <span className="muted">—</span>), hideBelow: 'lg', className: 'num' },
    { key: 'value', header: t('inventory.col.value'), render: it => <span className="money">{money(itemValue(it))}</span>, hideBelow: 'md', className: 'num' },
    { key: 'supplier', header: t('inventory.col.supplier'), render: it => (it.supplier ? <span className="truncate inv-supplier inv-auto" dir="auto" title={it.supplier}>{it.supplier}</span> : <span className="muted">—</span>), hideBelow: 'lg' },
    { key: 'expiry', header: t('inventory.col.expiry'), render: it => <ExpiryBadge date={it.expiryDate} today={today} always />, hideBelow: 'sm' },
    { key: 'actions', header: <span className="sr-only">{t('actions')}</span>, render: it => <RowMenu items={menuFor(it)} label={t('actions')} />, className: 'actions', width: 56 },
  ]

  // ---- render ----
  const loading = items === undefined
  const noItems = !loading && items.length === 0
  const headerActions = (
    <>
      {!noItems && (mobile
        ? <Button variant="secondary" icon={<Download />} aria-label={t('inventory.exportCsv')} title={t('inventory.exportCsv')} onClick={exportCsv} disabled={loading} />
        : <Button variant="secondary" icon={<Download />} onClick={exportCsv} disabled={loading}>{t('inventory.exportCsv')}</Button>)}
      {!noItems && <Button variant="secondary" icon={<ShoppingCart />} onClick={() => setPurchase({ open: true })} disabled={readOnly || loading}>{t('inventory.purchase')}</Button>}
      <Button variant="primary" icon={<Plus />} onClick={() => setForm({ open: true })} disabled={readOnly}>{t('inventory.newItem')}</Button>
    </>
  )

  return (
    <div className="page inv-page">
      <PageHeader title={t('inventory.title')} subtitle={t('inventory.subtitle')} actions={headerActions} />
      {readOnly && <Alert tone="warning" className="mb-4">{t('trial.readonly')}</Alert>}

      {/* stats */}
      {!noItems && <div className="inv-stats">
        {!stats ? [0, 1, 2, 3].map(i => <div key={i} className="card stat-card"><Skeleton w={46} h={46} r={14} /><div className="grow col gap-2"><Skeleton w="50%" /><Skeleton w="70%" h={22} /></div></div>) : <>
          <StatCard tone="primary" icon={<Boxes />} label={t('inventory.stat.items')} value={<span className="num">{stats.count}</span>} sub={t('inventory.stat.itemsSub')} />
          <StatCard tone={stats.low ? 'danger' : 'success'} icon={<TriangleAlert />} label={t('inventory.stat.low')} value={<span className="num">{stats.low}</span>}
            sub={stats.low ? t('inventory.stat.lowSub') : t('inventory.stat.allGood')} onClick={stats.low ? () => { setTab('items'); setLowOnly(v => !v) } : undefined} />
          <StatCard tone={stats.expiring ? 'warning' : 'success'} icon={<CalendarClock />} label={t('inventory.stat.expiring')} value={<span className="num">{stats.expiring}</span>}
            sub={stats.expiring ? t('inventory.stat.expiringSub') : t('inventory.stat.allGood')} onClick={stats.expiring ? () => { setTab('items'); setExpiringOnly(v => !v) } : undefined} />
          <StatCard tone="info" icon={<Coins />} label={t('inventory.stat.value')} value={<span className="money">{money(stats.value)}</span>} sub={t('inventory.stat.valueSub')} />
        </>}
      </div>}

      {!readOnly && lowItems.length > 0 && tab === 'items' && (
        <div className="inv-reorder">
          <TriangleAlert className="inv-reorder-icon" />
          <div className="grow">
            <div className="strong">{tn(t, lang, 'inventory.reorder.title', lowItems.length)}</div>
            <div className="inv-reorder-names truncate">{lowItems.slice(0, 4).map((i, k) => <span key={i.id}>{k > 0 && (lang === 'ar' ? '، ' : ', ')}<bdi>{i.name}</bdi></span>)}{lowItems.length > 4 ? '…' : ''}</div>
          </div>
          <Button size="sm" variant="primary" icon={<ShoppingCart />} onClick={() => setPurchase({ open: true, ids: lowItems.map(i => i.id) })}>{t('inventory.reorder.action')}</Button>
        </div>
      )}

      {noItems ? (
        <div className="card">
          <EmptyState icon={<Boxes />} title={t('inventory.empty.title')} description={t('inventory.empty.desc')}
            actions={!readOnly && <Button variant="primary" icon={<PackagePlus />} onClick={() => setForm({ open: true })}>{t('inventory.addFirst')}</Button>} />
        </div>
      ) : (
        <>
          <Tabs<TabId> className="inv-tabs" value={tab} onChange={setTab} tabs={[
            { id: 'items', label: t('inventory.tab.items'), icon: <Boxes />, count: items?.filter(i => i.active).length },
            { id: 'movements', label: t('inventory.tab.movements'), icon: <History />, count: movementCount },
          ]} />

          {tab === 'movements' ? <MovementsTab movements={movements} items={items} onOpenItem={setHistoryId} /> : (
            <div className="col gap-3">
              <div className="inv-toolbar">
                <div className="inv-search">
                  <Input iconStart={<Search />} placeholder={t('inventory.searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} clearable onClear={() => setQ('')} aria-label={t('search')} />
                </div>
                <div className="inv-toggles">
                  <Switch checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} label={t('inventory.lowOnly')} />
                  <Switch checked={showInactive} onChange={e => setShowInactive(e.target.checked)} label={t('inventory.showInactive')} />
                </div>
              </div>
              {(categories.length > 1 || expiringOnly) && (
                <div className="inv-chips">
                  <Chip active={!category} onClick={() => setCategory('')}>{t('inventory.allCategories')}</Chip>
                  {categories.map(c => (
                    <Chip key={c.value} active={category === c.value} onClick={() => setCategory(category === c.value ? '' : c.value)}>
                      <span className="inv-chip-label truncate" dir="auto" title={catLabel(t, c.value)}>{catLabel(t, c.value)}</span><span className="inv-chip-count num">{c.count}</span>
                    </Chip>
                  ))}
                  {expiringOnly && <Chip active className="inv-chip-warn" icon={<CalendarClock />} onRemove={() => setExpiringOnly(false)} onClick={() => setExpiringOnly(false)}>{t('inventory.expiringOnly')}</Chip>}
                </div>
              )}

              {loading ? (
                <div className="card card-pad col gap-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="row gap-3"><Skeleton w={40} h={40} r={12} /><div className="grow col gap-2"><Skeleton w="40%" /><Skeleton w="25%" h={10} /></div><Skeleton w={90} h={28} /></div>)}</div>
              ) : rows.length === 0 ? (
                <div className="card">
                  <EmptyState compact icon={<Search />} title={t('noResults')} description={t('inventory.noResults.desc')}
                    actions={filtered ? <Button variant="secondary" icon={<X />} onClick={clearFilters}>{t('inventory.clearFilters')}</Button>
                      : !showInactive && items!.some(i => !i.active) ? <Button variant="secondary" icon={<Eye />} onClick={() => setShowInactive(true)}>{t('inventory.showInactive')}</Button> : undefined} />
                </div>
              ) : mobile ? (
                <div className="inv-cards">
                  {pg.slice.map(it => (
                    <div key={it.id} className={`card inv-card${!it.active ? ' is-inactive' : ''}${it.active && isOutOfStock(it) ? ' is-out' : it.active && isLowStock(it) ? ' is-low' : ''}`} onClick={() => setHistoryId(it.id)}>
                      <div className="inv-card-top">
                        <div className="grow">{itemCell(it)}</div>
                        <RowMenu items={menuFor(it)} label={t('actions')} size="md" />
                      </div>
                      <div className="inv-card-bottom">
                        <div className="inv-card-facts">
                          <span>{t('inventory.minLabel', { n: qtyText(it.minQuantity, lang) })}</span>
                          <span className="money">{money(itemValue(it))}</span>
                          <ExpiryBadge date={it.expiryDate} today={today} />
                        </div>
                        {qtyCell(it, true)}
                      </div>
                    </div>
                  ))}
                  {pg.pages > 1 && <div className="card"><Pagination {...pg} /></div>}
                </div>
              ) : (
                <DataTable columns={columns} rows={pg.slice} rowKey={i => i.id} onRowClick={i => setHistoryId(i.id)}
                  rowClassName={i => (!i.active ? 'inv-row-inactive' : undefined)} footer={<Pagination {...pg} />} />
              )}
              {!loading && rows.length > 0 && (
                <div className="inv-foot muted text-sm">
                  <Eye />{tn(t, lang, 'inventory.itemsCount', rows.length)} · {t('inventory.col.value')}: <span className="money">{money(rows.reduce((a, i) => a + (i.active ? itemValue(i) : 0), 0))}</span>
                  {filtered && <button type="button" className="inv-link-btn" onClick={clearFilters}>{t('inventory.clearFilters')}</button>}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {moveItem && move && <QuickMovePopover key={`${move.id}-${move.dir}`} item={moveItem} dir={move.dir} anchor={move.anchor} onClose={closeMove} />}
      <ItemFormModal open={form.open} item={form.item} onClose={() => setForm({ open: false })} />
      <PurchaseModal open={purchase.open} initialItemIds={purchase.ids} onClose={() => setPurchase({ open: false })} />
      <MovementsDrawer itemId={historyId} onClose={() => setHistoryId(null)} onEdit={id => { const it = items?.find(i => i.id === id); if (it) { setHistoryId(null); setForm({ open: true, item: it }) } }} />
    </div>
  )
}

