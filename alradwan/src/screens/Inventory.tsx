import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck, FileSpreadsheet, History, AlertTriangle, MessageCircle, Truck } from 'lucide-react'
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
  const [tab, setTab] = useState<'all' | 'low' | 'moves' | 'reorder'>(params.get('low') ? 'low' : 'all')
  const purchases = useCollection('purchases'); const sales = useCollection('sales'); const suppliers = useCollection('suppliers')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(150)
  const [adjust, setAdjust] = useState<Product | null>(null)
  const [hist, setHist] = useState<Product | null>(null)

  const list = useMemo(() => Array.from(products.values()).filter(p => p.kind === 'product').filter(p => matches(q, p.name, p.code, p.barcode, p.brand, p.cars, p.location)).filter(p => tab !== 'low' || (stock.get(p.id) ?? 0) <= p.minStock).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [products, q, tab, stock])
  const totals = useMemo(() => { let value = 0, qty = 0, low = 0, out = 0; for (const p of products.values()) { if (p.kind !== 'product') continue; const s = stock.get(p.id) ?? 0; value += s * p.cost; qty += s; if (s <= 0) out++; else if (s <= p.minStock) low++ } return { value, qty, low, out } }, [products, stock])
  // what to order: for every part at or under its alert level, enough to cover the alert level twice or a month
  // of sales (whichever is more), grouped by the supplier it was last bought from
  const reorder = useMemo(() => {
    const since = Date.now() - 90 * 86400000
    const sold = new Map<string, number>()
    for (const s of sales.values()) if (s.type === 'sale' && s.date >= since) for (const i of s.items) if (i.productId) sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.qty)
    const lastSupplier = new Map<string, { id?: string; name: string; date: number; cost: number }>()
    for (const p of purchases.values()) if (p.type === 'purchase') for (const i of p.items) { const prev = lastSupplier.get(i.productId); if (!prev || p.date > prev.date) lastSupplier.set(i.productId, { id: p.supplierId, name: p.supplierName, date: p.date, cost: i.cost }) }
    const rows: { p: Product; stock: number; monthly: number; qty: number; supplier: { id?: string; name: string; cost: number } }[] = []
    for (const p of products.values()) {
      if (p.kind !== 'product') continue
      const st = stock.get(p.id) ?? 0
      if (st > p.minStock || (p.minStock <= 0 && st >= 0)) continue
      const monthly = Math.ceil((sold.get(p.id) ?? 0) / 3)
      const qty = Math.max(p.minStock * 2 - st, monthly, 1)
      const sup = lastSupplier.get(p.id)
      rows.push({ p, stock: st, monthly, qty, supplier: sup ? { id: sup.id, name: sup.name, cost: sup.cost } : { name: 'بلا مورد معروف', cost: p.cost } })
    }
    const groups = new Map<string, { name: string; phone?: string; rows: typeof rows }>()
    for (const r of rows) { const k = r.supplier.id ?? r.supplier.name; const g = groups.get(k) ?? { name: r.supplier.name, phone: r.supplier.id ? suppliers.get(r.supplier.id)?.phone : undefined, rows: [] }; g.rows.push(r); groups.set(k, g) }
    return Array.from(groups.values()).sort((a, b) => b.rows.length - a.rows.length)
  }, [products, stock, sales, purchases, suppliers])
  const reorderMessage = (g: { name: string; rows: { p: Product; qty: number }[] }) => `مرحباً ${g.name}،\nنرجو تجهيز الطلبية التالية:\n${g.rows.map(r => `• ${r.p.name}${r.p.code ? ` (${r.p.code})` : ''} × ${r.qty} ${r.p.unit}`).join('\n')}\nشكراً.`
  const exportReorder = () => exportSheet('طلبية-مقترحة', reorder.flatMap(g => g.rows.map(r => ({ 'المورد': g.name, 'الكود': r.p.code, 'الاسم': r.p.name, 'المتوفر': r.stock, 'حد التنبيه': r.p.minStock, 'مبيعات الشهر': r.monthly, 'الكمية المقترحة': r.qty, 'الوحدة': r.p.unit, ...(seeCost ? { 'آخر كلفة': r.supplier.cost, 'التقدير': r.supplier.cost * r.qty } : {}) }))), 'الطلبية')
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
      <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: 'كل القطع' }, { id: 'low', label: `تنبيهات النقص (${totals.low + totals.out})` }, { id: 'reorder', label: 'اقتراح طلبية' }, { id: 'moves', label: 'حركات المخزون' }]} />
      <div className="card">
        {tab === 'reorder' ? (reorder.length === 0 ? <Empty title="لا شيء يحتاج طلباً" text="كل القطع فوق حد التنبيه" /> : (
          <div className="stack" style={{ padding: 12 }}>
            <div className="between"><span className="muted small">الكمية المقترحة = ضعف حد التنبيه ناقص المتوفر، أو مبيعات شهر (آخر 90 يوماً)، أيهما أكبر — مجمّعة حسب آخر مورد اشتريت منه.</span><button className="btn sm" onClick={exportReorder}><FileSpreadsheet /> إكسل</button></div>
            {reorder.map(g => (
              <div key={g.name} className="card pad" style={{ padding: 10 }}>
                <div className="between" style={{ marginBottom: 6 }}><b><Truck size={16} style={{ verticalAlign: -3 }} /> {g.name} <span className="muted small">({g.rows.length} صنف{seeCost ? ` · تقدير ${money(g.rows.reduce((t, r) => t + r.supplier.cost * r.qty, 0))}` : ''})</span></b><a className={`btn sm ${g.phone ? 'success' : ''}`} href={`https://wa.me/${g.phone ? g.phone.replace(/\D/g, '').replace(/^0/, '963') : ''}?text=${encodeURIComponent(reorderMessage(g))}`} target="_blank" rel="noreferrer"><MessageCircle /> إرسال الطلبية واتساب</a></div>
                <div className="table-wrap"><table className="table"><thead><tr><th>القطعة</th><th className="num">المتوفر</th><th className="num hide-mobile">حد التنبيه</th><th className="num hide-mobile">مبيعات الشهر</th><th className="num">اطلب</th></tr></thead>
                  <tbody>{g.rows.map(r => <tr key={r.p.id}><td><div className="bold">{r.p.name}</div><div className="small muted mono">{r.p.code}</div></td><td className={`num ${r.stock <= 0 ? 'neg-txt' : ''}`}>{num(r.stock, 2)}</td><td className="num hide-mobile muted">{r.p.minStock}</td><td className="num hide-mobile muted">{r.monthly}</td><td className="num bold">{r.qty} {r.p.unit}</td></tr>)}</tbody></table></div>
              </div>
            ))}
          </div>
        )) : tab !== 'moves' ? (list.length === 0 ? <Empty title={tab === 'low' ? 'لا نقص في المخزون' : 'لا قطع'} /> : (<>
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
