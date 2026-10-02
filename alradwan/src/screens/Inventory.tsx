import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck, FileSpreadsheet, History, AlertTriangle } from 'lucide-react'
import { useCollection, useCanSeeCost, usePerm } from '../db/store'
import type { Product, StockMovement } from '../db/types'
import { adjustStock } from '../db/actions'
import { fmtDateTime, matches, money, num } from '../lib/format'
import { Empty, Field, NumberInput, SearchInput, Stat, Tabs } from '../ui/components'
import { Modal } from '../ui/modal'
import { useToast } from '../ui/toast'
import { useProductStock } from '../ui/pickers'
import { exportSheet } from '../lib/excel'

const REASONS: Record<StockMovement['reason'], string> = { sale: 'بيع', sale_return: 'مرتجع بيع', purchase: 'شراء', purchase_return: 'مرتجع شراء', adjust: 'جرد / تعديل', opening: 'رصيد أول' }

export function Inventory() {
  const products = useCollection('products')
  const categories = useCollection('categories')
  const movements = useCollection('movements')
  const stock = useProductStock()
  const seeCost = useCanSeeCost()
  const canAdjust = usePerm('adjustStock')
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'all' | 'low' | 'moves'>(params.get('low') ? 'low' : 'all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(150)
  const [adjust, setAdjust] = useState<Product | null>(null)
  const [hist, setHist] = useState<Product | null>(null)

  const list = useMemo(() => Array.from(products.values()).filter(p => p.kind === 'product').filter(p => matches(q, p.name, p.code, p.barcode, p.brand, p.cars, p.location)).filter(p => tab !== 'low' || (stock.get(p.id) ?? 0) <= p.minStock).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [products, q, tab, stock])
  const totals = useMemo(() => { let value = 0, qty = 0, low = 0, out = 0; for (const p of products.values()) { if (p.kind !== 'product') continue; const s = stock.get(p.id) ?? 0; value += s * p.cost; qty += s; if (s <= 0) out++; else if (s <= p.minStock) low++ } return { value, qty, low, out } }, [products, stock])
  const moves = useMemo(() => Array.from(movements.values()).filter(m => { const p = products.get(m.productId); return p && matches(q, p.name, p.code, m.note) }).sort((a, b) => b.date - a.date).slice(0, 300), [movements, products, q])

  const exportExcel = () => exportSheet('جرد-المخزون', list.map(p => ({ 'الكود': p.code, 'الاسم': p.name, 'التصنيف': p.categoryId ? categories.get(p.categoryId)?.name ?? '' : '', 'المكان': p.location ?? '', 'الكمية': stock.get(p.id) ?? 0, 'حد التنبيه': p.minStock, ...(seeCost ? { 'الكلفة': p.cost, 'قيمة المخزون': (stock.get(p.id) ?? 0) * p.cost } : {}), 'الكمية الفعلية (للجرد)': '' })), 'الجرد')

  return (
    <div className="stack">
      <div className="grid cols-4 keep2">
        {seeCost && <Stat label="قيمة المخزون (بالكلفة)" value={money(totals.value)} icon={<ClipboardCheck />} tone="info" />}
        <Stat label="إجمالي القطع" value={num(totals.qty, 2)} sub={`${Array.from(products.values()).filter(p => p.kind === 'product').length} صنف`} icon={<ClipboardCheck />} tone="accent" />
        <Stat label="قاربت على النفاد" value={totals.low} icon={<AlertTriangle />} tone="warning" onClick={() => setTab('low')} />
        <Stat label="نفدت" value={totals.out} icon={<AlertTriangle />} tone="danger" onClick={() => setTab('low')} />
      </div>
      <div className="toolbar">
        <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث…" /></div>
        <button className="btn" onClick={exportExcel}><FileSpreadsheet /> <span className="hide-mobile">ورقة جرد (إكسل)</span></button>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: 'كل القطع' }, { id: 'low', label: `تنبيهات النقص (${totals.low + totals.out})` }, { id: 'moves', label: 'حركات المخزون' }]} />
      <div className="card">
        {tab !== 'moves' ? (list.length === 0 ? <Empty title={tab === 'low' ? 'لا نقص في المخزون' : 'لا قطع'} /> : (<>
          <div className="table-wrap"><table className="table">
            <thead><tr><th className="hide-mobile">الكود</th><th>الاسم</th><th className="hide-mobile">المكان</th><th className="num">الكمية</th><th className="num hide-mobile">حد التنبيه</th>{seeCost && <th className="num hide-mobile">القيمة</th>}<th className="actions"></th></tr></thead>
            <tbody>{list.slice(0, limit).map(p => { const s = stock.get(p.id) ?? 0; return (
              <tr key={p.id}>
                <td className="mono small muted hide-mobile" style={{ whiteSpace: 'nowrap' }}>{p.code}</td>
                <td><div className="bold">{p.name}</div><div className="small muted hide-desktop"><span className="mono">{p.code}</span>{p.location ? ` · ${p.location}` : ''}</div></td>
                <td className="hide-mobile muted small">{p.location}</td>
                <td className="num"><span className={`badge ${s <= 0 ? 'tone-danger' : s <= p.minStock ? 'tone-warning' : 'tone-success'}`}>{num(s, 2)} {p.unit}</span></td>
                <td className="num hide-mobile muted">{p.minStock}</td>
                {seeCost && <td className="num hide-mobile">{money(s * p.cost, { currency: false })}</td>}
                <td className="actions">{canAdjust && <button className="btn sm" onClick={() => setAdjust(p)}><ClipboardCheck /> جرد</button>}<button className="btn sm ghost icon" title="الحركات" onClick={() => setHist(p)}><History /></button></td>
              </tr>
            ) })}</tbody>
          </table></div>
          {list.length > limit && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn" onClick={() => setLimit(l => l + 300)}>عرض المزيد ({list.length - limit} متبقٍ)</button></div>}</>
        )) : (
          moves.length === 0 ? <Empty title="لا حركات بعد" /> : <MovesTable moves={moves} products={products} />
        )}
      </div>
      {adjust && <AdjustModal product={adjust} current={stock.get(adjust.id) ?? 0} onClose={() => setAdjust(null)} />}
      {hist && <Modal title={`حركات: ${hist.name}`} onClose={() => setHist(null)} size="wide"><MovesTable moves={Array.from(movements.values()).filter(m => m.productId === hist.id).sort((a, b) => b.date - a.date)} products={products} /><div className="mt bold">الكمية الحالية: {num(stock.get(hist.id) ?? 0, 2)} {hist.unit} (رصيد أول {hist.openingStock})</div></Modal>}
    </div>
  )
}

function MovesTable({ moves, products }: { moves: StockMovement[]; products: Map<string, Product> }) {
  if (moves.length === 0) return <Empty title="لا حركات" />
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>التاريخ</th><th>القطعة</th><th>النوع</th><th className="num">الكمية</th><th className="hide-mobile">ملاحظة</th></tr></thead>
      <tbody>{moves.map(m => <tr key={m.id}><td className="small muted">{fmtDateTime(m.date)}</td><td>{products.get(m.productId)?.name}</td><td>{REASONS[m.reason]}</td><td className={`num bold ${m.qty > 0 ? 'pos-txt' : 'neg-txt'}`}>{m.qty > 0 ? '+' : ''}{num(m.qty, 2)}</td><td className="hide-mobile small muted">{m.note}</td></tr>)}</tbody>
    </table></div>
  )
}

function AdjustModal({ product, current, onClose }: { product: Product; current: number; onClose: () => void }) {
  const [qty, setQty] = useState(current)
  const [note, setNote] = useState('')
  const toast = useToast()
  const save = async () => { await adjustStock(product, current, qty, note || 'جرد'); toast.success(qty === current ? 'لا تغيير' : `تم تعديل الكمية إلى ${qty}`); onClose() }
  return (
    <Modal title={`جرد: ${product.name}`} onClose={onClose} size="narrow" footer={<><button className="btn primary" onClick={save}>حفظ</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        <div className="between"><span className="muted">الكمية في البرنامج</span><b>{num(current, 2)} {product.unit}</b></div>
        <Field label="الكمية الفعلية الموجودة في المحل"><NumberInput value={qty} onChange={setQty} lg autoFocus onEnter={save} /></Field>
        {qty !== current && <div className={`badge ${qty > current ? 'tone-success' : 'tone-danger'}`} style={{ alignSelf: 'flex-start' }}>{qty > current ? `زيادة ${num(qty - current, 2)}` : `نقص ${num(current - qty, 2)}`}</div>}
        <Field label="السبب (اختياري)"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="تالف، ضائع، خطأ إدخال…" /></Field>
      </div>
    </Modal>
  )
}
