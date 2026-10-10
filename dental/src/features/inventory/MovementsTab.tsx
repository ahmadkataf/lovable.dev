// Every stock movement, newest first: what came in, what went out, who did it.
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Search } from 'lucide-react'
import type { InventoryItem, StockMovement, StockReason } from '@/db/types'
import { Chip, DataTable, EmptyState, Input, Pagination, Skeleton, usePagination, type Column } from '@/ui'
import { useI18n } from '@/i18n'
import { useDebounced, useIsMobile, useUsers } from '@/app/hooks'
import { fmtDate, fmtTime } from '@/lib/dates'
import { matches } from '@/lib/format'
import { STOCK_REASONS, sortMovements } from './lib'
import { ReasonBadge, qtyText, reasonLabel, unitLabel } from './parts'

export default function MovementsTab({ movements, items, onOpenItem }: { movements: StockMovement[] | undefined; items: InventoryItem[] | undefined; onOpenItem: (id: string) => void }) {
  const { t, lang } = useI18n()
  const mobile = useIsMobile()
  const users = useUsers(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [reason, setReason] = useState<StockReason | ''>('')
  const byId = useMemo(() => new Map((items ?? []).map(i => [i.id, i])), [items])
  const userName = (id?: string) => users.find(u => u.id === id)?.name ?? '—'

  const rows = useMemo(() => {
    if (!movements) return []
    return sortMovements(movements).filter(m => {
      if (reason && m.reason !== reason) return false
      if (dq) { const it = byId.get(m.itemId); if (!(matches(it?.name, dq) || matches(it?.sku, dq) || matches(m.note, dq))) return false }
      return true
    })
  }, [movements, reason, dq, byId])
  const pg = usePagination(rows, 25)
  const used = useMemo(() => new Set((movements ?? []).map(m => m.reason)), [movements])

  if (!movements || !items) return <div className="card card-pad col gap-3">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={44} />)}</div>
  if (movements.length === 0) {
    return <div className="card"><EmptyState icon={<ArrowLeftRight />} title={t('inventory.movements.empty')} description={t('inventory.movements.emptyDesc')} /></div>
  }

  const itemCell = (m: StockMovement) => {
    const it = byId.get(m.itemId)
    return (
      <button type="button" className="inv-link" onClick={e => { e.stopPropagation(); onOpenItem(m.itemId) }}>
        <span className="cell-main truncate inv-auto" dir={it ? 'auto' : undefined}>{it ? it.name : t('inventory.deletedItem')}</span>
        {it?.sku && <span className="cell-sub ltr truncate">{it.sku}</span>}
      </button>
    )
  }
  const delta = (m: StockMovement) => {
    const it = byId.get(m.itemId)
    return <span className={`inv-delta ${m.delta >= 0 ? 'pos' : 'neg'}`}><span className="num">{m.delta >= 0 ? '+' : '−'}{qtyText(Math.abs(m.delta), lang)}</span>{it && <span className="inv-delta-unit">{unitLabel(t, it.unit)}</span>}</span>
  }

  const columns: Column<StockMovement>[] = [
    { key: 'date', header: t('inventory.col.date'), render: m => <div className="inv-nowrap"><div>{fmtDate(m.date, lang)}</div><div className="cell-sub">{fmtTime(m.createdAt, lang)}</div></div> },
    { key: 'item', header: t('inventory.col.item'), render: itemCell },
    { key: 'reason', header: t('inventory.col.reason'), render: m => <ReasonBadge reason={m.reason} /> },
    { key: 'delta', header: t('inventory.col.delta'), render: delta, className: 'inv-nowrap' },
    { key: 'note', header: t('inventory.col.note'), render: m => (m.note ? <span className="muted truncate inv-note inv-auto" dir="auto" title={m.note}>{m.note}</span> : <span className="muted">—</span>), hideBelow: 'lg' },
    { key: 'by', header: t('inventory.col.by'), render: m => <span className="muted inv-nowrap">{userName(m.by)}</span>, hideBelow: 'md' },
  ]

  return (
    <div className="col gap-3">
      <div className="inv-toolbar">
        <div className="inv-search">
          <Input iconStart={<Search />} placeholder={t('inventory.movements.search')} value={q} onChange={e => setQ(e.target.value)} clearable onClear={() => setQ('')} aria-label={t('search')} />
        </div>
        <div className="inv-chips">
          <Chip active={!reason} onClick={() => setReason('')}>{t('all')}</Chip>
          {STOCK_REASONS.filter(r => used.has(r)).map(r => <Chip key={r} active={reason === r} onClick={() => setReason(reason === r ? '' : r)}>{reasonLabel(t, r)}</Chip>)}
        </div>
      </div>
      {mobile ? (
        <div className="inv-cards">
          {rows.length === 0 && <div className="card"><EmptyState compact icon={<Search />} title={t('noResults')} /></div>}
          {pg.slice.map(m => (
            <div key={m.id} className="card inv-mcard" onClick={() => onOpenItem(m.itemId)}>
              <div className="row spread gap-2">
                <div className="grow truncate strong inv-auto" dir={byId.get(m.itemId) ? 'auto' : undefined}>{byId.get(m.itemId)?.name ?? t('inventory.deletedItem')}</div>
                {delta(m)}
              </div>
              <div className="row spread gap-2 mt-1">
                <ReasonBadge reason={m.reason} />
                <span className="text-sm muted inv-nowrap">{fmtDate(m.date, lang)} · {fmtTime(m.createdAt, lang)}</span>
              </div>
              {(m.note || m.by) && <div className="text-sm muted mt-1 truncate">{m.note && <bdi>{m.note}</bdi>}{m.note && m.by && ' · '}{m.by && userName(m.by)}</div>}
            </div>
          ))}
          {rows.length > 0 && <div className="card"><Pagination {...pg} /></div>}
        </div>
      ) : (
        <DataTable columns={columns} rows={pg.slice} rowKey={m => m.id} onRowClick={m => onOpenItem(m.itemId)}
          empty={<EmptyState compact icon={<Search />} title={t('noResults')} />} footer={<Pagination {...pg} />} />
      )}
    </div>
  )
}
