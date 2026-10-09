// الحركات: every stock movement, newest first, 200 at a time, filtered by product and type.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShoppingCart, Undo2, ShoppingBag, SlidersHorizontal, Flag, Upload, ClipboardCheck, Download, ArrowLeftRight, X, type LucideIcon } from 'lucide-react'
import { db } from '../../db'
import type { StockMove, StockMoveType } from '../../db/types'
import { useT } from '../../i18n'
import { Badge, Button, Empty, SearchInput, Select, Spinner, useIsMobile } from '../../components/ui'
import { formatDateTime, formatTime, formatDay, toDateInput } from '../../lib/format'
import { formatQty } from '../../lib/money'
import { saveCsv } from '../../lib/csv'
import { toast } from '../../state/store'
import { matchesProduct, signedQty } from './logic'
import { useProductsMap, unitLabel } from './shared'

export const MOVE_TYPES: StockMoveType[] = ['sale', 'refund', 'purchase', 'adjust', 'initial', 'import', 'count']
const ICONS: Record<StockMoveType, LucideIcon> = { sale: ShoppingCart, refund: Undo2, purchase: ShoppingBag, adjust: SlidersHorizontal, initial: Flag, import: Upload, count: ClipboardCheck }

export function MoveTypeBadge({ type, qty }: { type: StockMoveType; qty?: number }) {
  const t = useT()
  const Icon = ICONS[type]
  const kind = qty === undefined ? (type === 'initial' || type === 'import' ? 'info' : undefined) : qty > 0 ? 'primary' : qty < 0 ? 'danger' : undefined
  return <Badge kind={kind}><Icon size={12} /> {t('inventory.moves.type.' + type)}</Badge>
}

interface Ref { kind: 'sale' | 'refund' | 'purchase'; number: number; id: string }
interface MovesData { rows: StockMove[]; hasMore: boolean; refs: Map<string, Ref> }

const uniq = (a: string[]) => [...new Set(a)]
const PAGE = 200

export function MovesTab() {
  const t = useT()
  const mobile = useIsMobile()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const productId = params.get('product')
  const [q, setQ] = useState('')
  const [type, setType] = useState<StockMoveType | ''>('')
  const [limit, setLimit] = useState(PAGE)
  const products = useProductsMap()

  const data = useLiveQuery(async (): Promise<MovesData> => {
    let ids: Set<string> | null = null
    if (productId) ids = new Set([productId])
    else if (q.trim()) ids = new Set((await db.products.filter(p => matchesProduct(p, q)).primaryKeys()) as string[])
    let coll = db.stockMoves.orderBy('createdAt').reverse()
    if (ids || type) coll = coll.filter(m => (!ids || ids.has(m.productId)) && (!type || m.type === type))
    const rows = await coll.limit(limit + 1).toArray()
    const hasMore = rows.length > limit
    if (hasMore) rows.pop()
    const saleIds = uniq(rows.filter(m => m.type === 'sale' && m.refId).map(m => m.refId!))
    const refundIds = uniq(rows.filter(m => m.type === 'refund' && m.refId).map(m => m.refId!))
    const purchaseIds = uniq(rows.filter(m => (m.type === 'purchase' || m.type === 'adjust') && m.refId).map(m => m.refId!))
    const [sales, refunds, purchases] = await Promise.all([db.sales.bulkGet(saleIds), db.refunds.bulkGet(refundIds), db.purchases.bulkGet(purchaseIds)])
    const refs = new Map<string, Ref>()
    sales.forEach(s => { if (s) refs.set(s.id, { kind: 'sale', number: s.number, id: s.id }) })
    refunds.forEach(r => { if (r) refs.set(r.id, { kind: 'refund', number: r.saleNumber, id: r.id }) })
    purchases.forEach(p => { if (p) refs.set(p.id, { kind: 'purchase', number: p.number, id: p.id }) })
    return { rows, hasMore, refs }
  }, [q, type, limit, productId])

  const name = (m: StockMove) => products?.get(m.productId)?.name ?? t('inventory.moves.deleted')
  const unit = (m: StockMove) => unitLabel(products?.get(m.productId)?.unit ?? '')
  const refLabel = (m: StockMove): string | null => {
    const r = m.refId ? data?.refs.get(m.refId) : undefined
    if (r) return r.kind === 'purchase' ? t('inventory.moves.purchaseRef', { n: r.number }) : t('inventory.moves.receipt', { n: r.number })
    return null
  }
  const openRef = (m: StockMove) => {
    const r = m.refId ? data?.refs.get(m.refId) : undefined
    if (r?.kind === 'purchase') nav(`/inventory/purchases/${r.id}`)
  }
  const exportCsv = async () => {
    if (!data?.rows.length) return
    const rows = [[t('common.date'), t('inventory.moves.product'), t('inventory.moves.typeCol'), t('common.qty'), t('inventory.moves.before'), t('inventory.moves.after'), t('inventory.moves.ref'), t('common.note')]]
    for (const m of data.rows) rows.push([formatDateTime(m.createdAt), name(m), t('inventory.moves.type.' + m.type), formatQty(m.qty), formatQty(m.before), formatQty(m.after), refLabel(m) ?? '', m.note ?? ''])
    if (await saveCsv(`stock-moves-${toDateInput(Date.now())}.csv`, rows)) toast(t('inventory.exported'), 'success')
  }

  const selected = productId ? products?.get(productId) : undefined

  return (
    <div className="col">
      <div className="inv-toolbar">
        {selected ? (
          <button type="button" className="chip on" onClick={() => setParams({})}>{selected.name} <X size={14} /></button>
        ) : (
          <SearchInput className="grow" value={q} onChange={setQ} placeholder={t('inventory.moves.search')} noWedge />
        )}
        <Select value={type} onChange={e => { setType(e.target.value as StockMoveType | ''); setLimit(PAGE) }} className="inv-select-auto" aria-label={t('inventory.moves.typeCol')}>
          <option value="">{t('inventory.moves.allTypes')}</option>
          {MOVE_TYPES.map(k => <option key={k} value={k}>{t('inventory.moves.type.' + k)}</option>)}
        </Select>
        <Button variant="outline" icon={<Download size={18} />} iconOnly={mobile} onClick={() => void exportCsv()} disabled={!data?.rows.length} title={t('common.export')}>{t('common.export')}</Button>
      </div>

      {!data || !products ? <div className="empty"><Spinner /></div> : data.rows.length === 0 ? (
        <Empty icon={<ArrowLeftRight size={32} />} title={q || type || productId ? t('common.noResults') : t('inventory.moves.empty')} text={q || type || productId ? undefined : t('inventory.moves.emptyText')} />
      ) : mobile ? (
        <div className="card list">
          {data.rows.map(m => (
            <button key={m.id} type="button" className="list-row inv-move-row" onClick={() => openRef(m)}>
              <span className={`inv-move-ico ${m.qty > 0 ? 'in' : m.qty < 0 ? 'out' : ''}`}>{(() => { const I = ICONS[m.type]; return <I size={18} /> })()}</span>
              <span className="grow truncate">
                <span className="title truncate">{name(m)}</span>
                <span className="sub truncate">{t('inventory.moves.type.' + m.type)}{refLabel(m) ? ` · ${refLabel(m)}` : ''} · <span className="num">{formatQty(m.before)} → {formatQty(m.after)}</span>{m.note ? ` · ${m.note}` : ''}</span>
              </span>
              <span className="end">
                <span className={`num bold ${m.qty > 0 ? 'inv-pos' : m.qty < 0 ? 'inv-neg' : ''}`}>{signedQty(m.qty)} {unit(m)}</span>
                <span className="sub">{formatDay(m.createdAt)} {formatTime(m.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{t('common.date')}</th><th>{t('inventory.moves.product')}</th><th>{t('inventory.moves.typeCol')}</th>
              <th className="num">{t('common.qty')}</th><th className="num">{t('inventory.moves.before')}</th><th className="num">{t('inventory.moves.after')}</th>
              <th>{t('inventory.moves.ref')}</th><th>{t('common.note')}</th>
            </tr></thead>
            <tbody>
              {data.rows.map(m => (
                <tr key={m.id}>
                  <td className="num muted">{formatDateTime(m.createdAt)}</td>
                  <td className="bold">{name(m)}</td>
                  <td><MoveTypeBadge type={m.type} qty={m.qty} /></td>
                  <td className={`num bold ${m.qty > 0 ? 'inv-pos' : m.qty < 0 ? 'inv-neg' : ''}`}>{signedQty(m.qty)} {unit(m)}</td>
                  <td className="num muted">{formatQty(m.before)}</td>
                  <td className="num">{formatQty(m.after)}</td>
                  <td>{refLabel(m) ? (data.refs.get(m.refId!)?.kind === 'purchase' ? <button type="button" className="inv-link num" onClick={() => openRef(m)}>{refLabel(m)}</button> : <span className="num">{refLabel(m)}</span>) : <span className="faint">—</span>}</td>
                  <td className="muted inv-note-cell">{m.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.hasMore && <Button block variant="outline" onClick={() => setLimit(l => l + PAGE)}>{t('inventory.moves.more')}</Button>}
    </div>
  )
}
