// المخزون: every active product with its stock, quick +/− adjustments and a single-product count.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Plus, Minus, ClipboardCheck, Download, AlertTriangle, PackageX, Boxes, Coins, Package } from 'lucide-react'
import { db } from '../../db'
import type { Product } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Empty, Field, Input, Modal, SearchInput, Select, Spinner, SwitchRow, useIsMobile } from '../../components/ui'
import { applyStock, setStock } from '../../lib/stock'
import { formatMoney, formatQty, parseNumber, round } from '../../lib/money'
import { formatDay, formatTime, toDateInput } from '../../lib/format'
import { saveCsv } from '../../lib/csv'
import { toast, useSettings, useUser, isAdmin } from '../../state/store'
import { allowed } from '../../lib/audit'
import { stockValueFx } from '../../lib/fx'
import { filterProducts, productValue, stockCounts, stockValue, type StockFilter, type StockSort } from './logic'
import { AmountPad, ProductAvatar, StockBadge, unitLabel } from './shared'
import { MoveTypeBadge } from './MovesTab'

export function StockTab() {
  const t = useT()
  const user = useUser()
  const settings = useSettings()
  const admin = isAdmin(user) || allowed(user, settings, 'cashierSeeCost')
  const canAdjust = allowed(user, settings, 'cashierAdjustStock')
  const c = settings.currency
  const d = c.decimals
  const c2 = settings.currency2
  const showFx = c2.enabled && c2.rate > 0
  const mobile = useIsMobile()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<StockFilter>('all')
  const [sort, setSort] = useState<StockSort>('name')
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [adjust, setAdjust] = useState<{ id: string; dir: 1 | -1 } | null>(null)
  const [countId, setCountId] = useState<string | null>(null)
  const products = useLiveQuery(() => db.products.filter(p => p.active).toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [], [])
  const byId = useMemo(() => new Map((products ?? []).map(p => [p.id, p])), [products])
  const catName = (id?: string) => categories.find(x => x.id === id)?.name

  if (!products) return <div className="empty"><Spinner /></div>
  const counts = stockCounts(products)
  const list = filterProducts(products, { q, filter, sort, decimals: d })
  const value = stockValue(products, d)
  const valueFx = showFx ? stockValueFx(products, c2) : 0
  /** Unit cost in the second currency: the product's own anchor, else today's conversion. */
  const fxCostOf = (p: Product) => (typeof p.fxCost === 'number' ? p.fxCost : round(p.cost / c2.rate, c2.decimals))

  const exportCsv = async () => {
    const head = [t('common.name'), t('common.barcode'), 'SKU', t('common.category'), t('inventory.unit'), t('common.qty'), t('inventory.stock.lowAt'), t('common.price')]
    if (admin) head.push(t('common.cost'), t('inventory.stock.value'))
    if (admin && showFx) head.push(`cost_${c2.code}`, `value_${c2.code}`)
    const rows: (string | number)[][] = [head]
    for (const p of list) {
      const r: (string | number)[] = [p.name, p.barcodes[0] ?? '', p.sku ?? '', catName(p.categoryId) ?? '', unitLabel(p.unit), p.trackStock ? formatQty(p.stock) : t('inventory.stock.untracked'), p.lowStock || '', p.price]
      if (admin) r.push(p.cost, productValue(p, d))
      if (admin && showFx) r.push(fxCostOf(p), p.trackStock && p.stock > 0 ? round(p.stock * fxCostOf(p), c2.decimals) : 0)
      rows.push(r)
    }
    if (await saveCsv(`stock-${toDateInput(Date.now())}.csv`, rows)) toast(t('inventory.exported'), 'success')
  }

  const chips: { key: StockFilter; label: string; n: number }[] = [
    { key: 'all', label: t('common.all'), n: counts.all }, { key: 'low', label: t('inventory.stock.chipLow'), n: counts.low },
    { key: 'out', label: t('inventory.stock.chipOut'), n: counts.out }, { key: 'expiring', label: t('inventory.stock.chipExpiring'), n: counts.expiring }, { key: 'untracked', label: t('inventory.stock.untracked'), n: counts.untracked },
  ]
  const sheet = sheetId ? byId.get(sheetId) : undefined
  const adjustP = adjust ? byId.get(adjust.id) : undefined
  const countP = countId ? byId.get(countId) : undefined
  const actions = (p: Product) => (
    <div className="row inv-row-actions" onClick={e => e.stopPropagation()}>
      <Button variant="soft" iconOnly icon={<Plus size={18} />} disabled={!p.trackStock || !canAdjust} onClick={() => setAdjust({ id: p.id, dir: 1 })} title={t('inventory.stock.add')} aria-label={t('inventory.stock.add')} />
      <Button variant="soft-danger" iconOnly icon={<Minus size={18} />} disabled={!p.trackStock || !canAdjust} onClick={() => setAdjust({ id: p.id, dir: -1 })} title={t('inventory.stock.remove')} aria-label={t('inventory.stock.remove')} />
      <Button icon={<ClipboardCheck size={18} />} disabled={!p.trackStock || !canAdjust} onClick={() => setCountId(p.id)}>{t('inventory.stock.count')}</Button>
    </div>
  )

  return (
    <div className="col">
      <div className="stats inv-stats">
        {admin && <button type="button" className="stat inv-stat" onClick={() => setFilter('all')}><div className="stat-label"><Coins size={14} /> {t('inventory.stock.value')}</div><div className="stat-value num">{formatMoney(value, c)}</div><div className="stat-sub">{t('inventory.stock.valueSub')}{showFx && <>{' · ≈ '}<span className="num">{formatMoney(valueFx, c2)}</span></>}</div></button>}
        <button type="button" className={`stat inv-stat ${filter === 'low' ? 'on' : ''}`} onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}><div className="stat-label"><AlertTriangle size={14} /> {t('inventory.stock.lowCount')}</div><div className={`stat-value num ${counts.low ? 'inv-warn' : ''}`}>{counts.low}</div>{counts.low > 0 && canAdjust && <div className="stat-sub"><span className="btn soft sm" role="link" onClick={e => { e.stopPropagation(); nav('/inventory/purchases/new?low=1') }}>{t('inventory.stock.reorder')}</span></div>}</button>
        <button type="button" className={`stat inv-stat ${filter === 'out' ? 'on' : ''}`} onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}><div className="stat-label"><PackageX size={14} /> {t('inventory.stock.outCount')}</div><div className={`stat-value num ${counts.out ? 'inv-neg' : ''}`}>{counts.out}</div></button>
        {!mobile && <div className="stat"><div className="stat-label"><Boxes size={14} /> {t('inventory.stock.products')}</div><div className="stat-value num">{counts.all}</div></div>}
      </div>

      <div className="inv-toolbar">
        <SearchInput className="grow" value={q} onChange={setQ} placeholder={t('inventory.stock.search')} noWedge />
        <Select value={sort} onChange={e => setSort(e.target.value as StockSort)} className="inv-select-auto" aria-label={t('common.sort')}>
          <option value="name">{t('inventory.stock.sort.name')}</option>
          <option value="lowest">{t('inventory.stock.sort.lowest')}</option>
          {admin && <option value="value">{t('inventory.stock.sort.value')}</option>}
        </Select>
        <Button variant="outline" icon={<Download size={18} />} iconOnly={mobile} onClick={() => void exportCsv()} disabled={!list.length} title={t('common.export')}>{t('common.export')}</Button>
      </div>
      <div className="chips">
        {chips.map(ch => <button key={ch.key} type="button" className={`chip ${filter === ch.key ? 'on' : ''}`} onClick={() => setFilter(ch.key)}>{ch.label} <span className="num inv-chip-n">{ch.n}</span></button>)}
      </div>

      {products.length === 0 ? (
        <Empty icon={<Package size={32} />} title={t('inventory.stock.empty')} text={t('inventory.stock.emptyText')} action={<Button variant="primary" onClick={() => nav('/products')}>{t('nav.products')}</Button>} />
      ) : list.length === 0 ? (
        <Empty title={t('common.noResults')} />
      ) : mobile ? (
        <div className="card list">
          {list.map(p => (
            <button key={p.id} type="button" className="list-row" onClick={() => setSheetId(p.id)}>
              <ProductAvatar p={p} />
              <span className="grow truncate">
                <span className="title truncate">{p.name}</span>
                <span className="sub truncate">{[catName(p.categoryId), admin && productValue(p, d) > 0 ? formatMoney(productValue(p, d), c) : null].filter(Boolean).join(' · ') || (p.barcodes[0] ?? '')}</span>
              </span>
              <span className="end">
                <StockBadge p={p} />
                {p.trackStock && p.lowStock > 0 && <span className="sub num">{t('inventory.stock.lowAtShort', { n: formatQty(p.lowStock) })}</span>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{t('inventory.moves.product')}</th><th>{t('common.category')}</th><th className="num">{t('common.qty')}</th><th className="num">{t('inventory.stock.lowAt')}</th>
              {admin && <th className="num">{t('common.cost')}</th>}{admin && <th className="num">{t('inventory.stock.value')}</th>}<th />
            </tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} className="inv-clickable" onClick={() => setSheetId(p.id)}>
                  <td><div className="row"><ProductAvatar p={p} size={34} /><div className="truncate"><div className="bold truncate">{p.name}</div><div className="xs faint num">{p.barcodes[0] ?? p.sku ?? ''}</div></div></div></td>
                  <td className="muted">{catName(p.categoryId) ?? '—'}</td>
                  <td className="num"><StockBadge p={p} /></td>
                  <td className="num muted">{p.trackStock && p.lowStock > 0 ? formatQty(p.lowStock) : '—'}</td>
                  {admin && <td className="num">{formatMoney(p.cost, c)}</td>}
                  {admin && <td className="num bold">{formatMoney(productValue(p, d), c)}</td>}
                  <td>{actions(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sheet && <ProductSheet p={sheet} admin={admin} canAdjust={canAdjust} onClose={() => setSheetId(null)} onAdjust={dir => { setAdjust({ id: sheet.id, dir }) }} onCount={() => setCountId(sheet.id)} />}
      {adjustP && adjust && <AdjustModal p={adjustP} dir={adjust.dir} onClose={() => setAdjust(null)} />}
      {countP && <CountModal p={countP} onClose={() => setCountId(null)} />}
    </div>
  )
}

/** The product's stock card: numbers, the tracking switch, the three actions and the last moves. */
function ProductSheet({ p, admin, canAdjust, onClose, onAdjust, onCount }: { p: Product; admin: boolean; canAdjust: boolean; onClose: () => void; onAdjust: (dir: 1 | -1) => void; onCount: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const settings = useSettings()
  const c = settings.currency
  const c2 = settings.currency2
  const moves = useLiveQuery(async () => (await db.stockMoves.where('productId').equals(p.id).sortBy('createdAt')).slice(-5).reverse(), [p.id], [])
  const toggleTrack = async (on: boolean) => {
    await db.products.update(p.id, { trackStock: on, updatedAt: Date.now() })
    toast(t('common.saved'), 'success')
  }
  return (
    <Modal open onClose={onClose} title={p.name} size="narrow">
      <div className="col">
        <div className="row">
          <ProductAvatar p={p} size={48} />
          <div className="grow truncate"><div className="small faint num truncate">{p.barcodes[0] ?? p.sku ?? ''}</div><div className="small muted">{unitLabel(p.unit)}{p.allowFraction ? ` · ${t('inventory.fraction')}` : ''}</div></div>
          <StockBadge p={p} />
        </div>
        <div className="stats inv-stats-2">
          <div className="stat"><div className="stat-label">{t('inventory.stock.current')}</div><div className="stat-value num">{p.trackStock ? formatQty(p.stock) : '—'}</div></div>
          <div className="stat"><div className="stat-label">{t('inventory.stock.lowAt')}</div><div className="stat-value num">{p.lowStock > 0 ? formatQty(p.lowStock) : '—'}</div></div>
          {admin && <div className="stat"><div className="stat-label">{t('common.cost')}</div><div className="stat-value num">{formatMoney(p.cost, c)}</div>{c2.enabled && typeof p.fxCost === 'number' && <div className="stat-sub num">{formatMoney(p.fxCost, c2)}</div>}</div>}
          {admin && <div className="stat"><div className="stat-label">{t('inventory.stock.value')}</div><div className="stat-value num">{formatMoney(productValue(p, c.decimals), c)}</div></div>}
        </div>
        <SwitchRow label={t('inventory.stock.trackSwitch')} desc={t('inventory.stock.trackDesc')} on={p.trackStock} onChange={v => void toggleTrack(v)} disabled={!canAdjust} />
        <div className="inv-actions-3">
          <Button variant="soft" size="lg" icon={<Plus size={18} />} disabled={!p.trackStock || !canAdjust} onClick={() => onAdjust(1)}>{t('inventory.stock.add')}</Button>
          <Button variant="soft-danger" size="lg" icon={<Minus size={18} />} disabled={!p.trackStock || !canAdjust} onClick={() => onAdjust(-1)}>{t('inventory.stock.remove')}</Button>
          <Button size="lg" icon={<ClipboardCheck size={18} />} disabled={!p.trackStock || !canAdjust} onClick={onCount}>{t('inventory.stock.count')}</Button>
        </div>
        <div className="section-title">{t('inventory.stock.recentMoves')}<Button variant="ghost" size="sm" onClick={() => { onClose(); nav(`/inventory/moves?product=${p.id}`) }}>{t('inventory.stock.allMoves')}</Button></div>
        {moves.length === 0 ? <p className="faint small center">{t('inventory.moves.none')}</p> : (
          <div className="card flat list">
            {moves.map(m => (
              <div key={m.id} className="list-row inv-mini-row">
                <MoveTypeBadge type={m.type} qty={m.qty} />
                <span className="grow truncate small muted">{m.note ?? ''}</span>
                <span className="end"><span className={`num bold ${m.qty > 0 ? 'inv-pos' : m.qty < 0 ? 'inv-neg' : ''}`}>{m.qty > 0 ? '+' : ''}{formatQty(m.qty)}</span><span className="sub">{formatDay(m.createdAt)} {formatTime(m.createdAt)}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

/** + / −: an amount and a reason → applyStock 'adjust'. */
function AdjustModal({ p, dir, onClose }: { p: Product; dir: 1 | -1; onClose: () => void }) {
  const t = useT()
  const user = useUser()
  const settings = useSettings()
  const [v, setV] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const n = parseNumber(v)
  const after = round(p.stock + dir * n, 3)
  const blocked = dir < 0 && after < 0 && !settings.pos.allowNegativeStock
  const ok = n > 0 && !blocked
  const confirm = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      await applyStock([{ productId: p.id, qty: dir * n, type: 'adjust', note: reason.trim() || undefined, userId: user?.id }])
      toast(t('inventory.stock.adjusted', { name: p.name, qty: formatQty(after) }), 'success')
      onClose()
    } catch { toast(t('common.error'), 'error'); setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={dir > 0 ? t('inventory.stock.adjustAdd') : t('inventory.stock.adjustRemove')} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={dir > 0 ? 'primary' : 'danger'} disabled={!ok} loading={busy} onClick={() => void confirm()}>{t('common.confirm')}</Button>
      </>
    }>
      <div className="col">
        <div className="row"><ProductAvatar p={p} size={36} /><div className="grow bold truncate">{p.name}</div></div>
        <div className="inv-before-after">
          <span><span className="xs faint">{t('inventory.stock.current')}</span><b className="num">{formatQty(p.stock)}</b></span>
          <span className="inv-arrow">←</span>
          <span><span className="xs faint">{t('inventory.stock.newQty')}</span><b className={`num ${after < 0 ? 'inv-neg' : ''}`}>{formatQty(after)}</b></span>
        </div>
        {blocked && <div className="banner danger">{t('inventory.stock.negativeBlocked')}</div>}
        <AmountPad value={v} onChange={setV} decimals={p.allowFraction ? 3 : 0} suffix={unitLabel(p.unit)} onEnter={() => void confirm()} />
        <Field label={t('inventory.stock.reason')}><Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('inventory.stock.reasonPh')} /></Field>
      </div>
    </Modal>
  )
}

/** جرد for one product: type the exact count → setStock (a 'count' move for the difference). */
function CountModal({ p, onClose }: { p: Product; onClose: () => void }) {
  const t = useT()
  const user = useUser()
  const [v, setV] = useState(() => formatQty(Math.max(0, p.stock)))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const n = parseNumber(v)
  const diff = round(n - p.stock, 3)
  const confirm = async () => {
    if (busy || v === '') return
    if (diff === 0) { toast(t('inventory.count.noChange'), 'info'); onClose(); return }
    setBusy(true)
    try {
      await setStock(p.id, n, user?.id, note.trim() || t('inventory.stock.countNote'))
      toast(t('inventory.stock.counted', { name: p.name, qty: formatQty(n) }), 'success')
      onClose()
    } catch { toast(t('common.error'), 'error'); setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={t('inventory.stock.setCount')} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={v === ''} loading={busy} onClick={() => void confirm()}>{t('common.confirm')}</Button>
      </>
    }>
      <div className="col">
        <div className="row"><ProductAvatar p={p} size={36} /><div className="grow bold truncate">{p.name}</div></div>
        <div className="inv-before-after">
          <span><span className="xs faint">{t('inventory.count.system')}</span><b className="num">{formatQty(p.stock)}</b></span>
          <span className="inv-arrow">←</span>
          <span><span className="xs faint">{t('inventory.count.diff')}</span><b className={`num ${diff > 0 ? 'inv-pos' : diff < 0 ? 'inv-neg' : ''}`}>{diff > 0 ? '+' : ''}{formatQty(diff)}</b></span>
        </div>
        <AmountPad value={v} onChange={setV} decimals={p.allowFraction ? 3 : 0} suffix={unitLabel(p.unit)} onEnter={() => void confirm()} />
        <Field label={t('common.note')}><Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('inventory.count.notePh')} /></Field>
      </div>
    </Modal>
  )
}
