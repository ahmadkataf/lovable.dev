import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Trash2, Printer, Save, MessageCircle, PlusCircle, Minus, Plus, Check, ShoppingCart, Percent } from 'lucide-react'
import { useCollection, useCanSeeCost, useSettings, useStore } from '../db/store'
import type { InvoiceItem, Product, Sale } from '../db/types'
import { saveSale } from '../db/actions'
import { saleTotals } from '../lib/calc'
import { CURRENCY_SYMBOL, convert, equiv, fmtDate, fromInputDate, invoiceNo, matches, money, num, otherCurrency, toInputDate } from '../lib/format'
import { Field, NumberInput, Chips, Price } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { ProductSearch, PartyPicker, useProductStock } from '../ui/pickers'
import { carLabel, productsForCar } from '../ui/cars'
import { Car, X } from 'lucide-react'
import { CustomerForm, ProductForm } from '../ui/forms'
import { printDocument } from '../print/PrintHost'

export function POS() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const editId = params.get('edit')
  const sales = useCollection('sales')
  const products = useCollection('products')
  const categories = useCollection('categories')
  const customers = useCollection('customers')
  const carModels = useCollection('carModels')
  const settings = useSettings()
  const seeCost = useCanSeeCost()
  const stock = useProductStock()
  const toast = useToast(); const confirm = useConfirm()

  const [items, setItems] = useState<InvoiceItem[]>([])
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [customerName, setCustomerName] = useState('زبون نقدي')
  const [discount, setDiscount] = useState(0)
  const [paid, setPaid] = useState<number | null>(null) // null = the whole amount
  const [date, setDate] = useState(toInputDate(Date.now()))
  const [notes, setNotes] = useState('')
  const [wholesale, setWholesale] = useState(false)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [addCustomer, setAddCustomer] = useState(false)
  const [addProduct, setAddProduct] = useState(false)
  const [done, setDone] = useState<Sale | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [carId, setCarId] = useState<string | null>(params.get('car'))
  const [carQ, setCarQ] = useState('')
  const [carOpen, setCarOpen] = useState(false)

  // opened from the car guide with a part to add
  useEffect(() => {
    const addId = params.get('add')
    if (addId) { const p = products.get(addId); if (p) add(p); setParams(carId ? { car: carId } : {}) }
  }, [params])

  // keyboard: F2 search, F4 customer, F9 save and print, F8 save, Escape empties the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); (document.querySelector('.catalog input.input') as HTMLInputElement | null)?.focus() }
      else if (e.key === 'F9') { e.preventDefault(); save(true) }
      else if (e.key === 'F8') { e.preventDefault(); save(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // editing an existing invoice
  useEffect(() => {
    if (!editId) return
    const s = sales.get(editId)
    if (!s) return
    setItems(s.items.map(i => ({ ...i }))); setCustomerId(s.customerId); setCustomerName(s.customerName); setDiscount(s.discount); setPaid(s.paid); setDate(toInputDate(s.date)); setNotes(s.notes ?? '')
  }, [editId])

  const { subtotal, total } = saleTotals(items, discount)
  const paidValue = paid === null ? total : Math.min(paid, total)

  // the customer's standing discount is applied as the invoice discount (the cashier can still change it)
  useEffect(() => {
    if (editId) return
    const c = customerId ? customers.get(customerId) : undefined
    if (c?.discountPct) setDiscount(Math.round(subtotal * c.discountPct) / 100)
  }, [customerId, subtotal, editId])


  const add = (p: Product) => {
    const price = wholesale && p.wholesalePrice ? p.wholesalePrice : p.price
    setItems(list => {
      const i = list.findIndex(x => x.productId === p.id && x.price === price)
      if (i >= 0) { const copy = [...list]; copy[i] = { ...copy[i], qty: copy[i].qty + 1 }; return copy }
      return [...list, { productId: p.id, name: p.name, code: p.code, qty: 1, price, cost: p.cost, discount: 0, unit: p.unit, kind: p.kind }]
    })
  }
  const update = (i: number, patch: Partial<InvoiceItem>) => setItems(list => list.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const removeAt = (i: number) => setItems(list => list.filter((_, k) => k !== i))

  const reset = () => { setItems([]); setCustomerId(undefined); setCustomerName('زبون نقدي'); setDiscount(0); setPaid(null); setDate(toInputDate(Date.now())); setNotes(''); setDone(null); if (editId) setParams({}) }

  const save = async (andPrint: boolean) => {
    if (items.length === 0) { toast.error('أضف قطعة واحدة على الأقل'); return }
    if (items.some(i => i.qty <= 0)) { toast.error('هناك سطر كميته صفر'); return }
    const short = items.filter(i => i.kind === 'product' && i.productId && (stock.get(i.productId) ?? 0) + (editId ? (sales.get(editId)?.items.find(x => x.productId === i.productId)?.qty ?? 0) : 0) < i.qty)
    if (short.length && !(await confirm({ title: 'الكمية غير متوفرة في المخزون', text: <div>{short.map(i => <div key={i.name}>• {i.name}: المتوفر {stock.get(i.productId!) ?? 0}، المطلوب {i.qty}</div>)}<p className="mt">هل تريد البيع على أي حال؟ (سيصبح المخزون بالسالب حتى تسجّل الشراء)</p></div>, okText: 'نعم، بيع' }))) return
    if (paidValue < total && !customerId && !(await confirm({ title: 'فاتورة آجلة بدون عميل', text: 'لم تختر عميلاً، فلن يُسجَّل الدين على أحد. هل تريد المتابعة؟', okText: 'متابعة' }))) return
    setBusy(true)
    try {
      const old = editId ? sales.get(editId) : undefined
      const sale = await saveSale({ id: old?.id, number: old?.number, type: 'sale', date: old && toInputDate(old.date) === date ? old.date : fromInputDate(date), customerId, customerName, items, discount, paid: paidValue, notes, returnOf: old?.returnOf })
      if (andPrint) printDocument({ type: 'invoice', sale })
      setDone(sale)
    } catch (e) { toast.error('تعذّر الحفظ: ' + (e as Error).message) } finally { setBusy(false) }
  }

  const catList = useMemo(() => Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [categories])
  const grid = useMemo(() => {
    const car = carId ? carModels.get(carId) : undefined
    const all = car ? productsForCar(products.values(), car) : Array.from(products.values())
    const list = all.filter(p => (cat === 'all' || p.categoryId === cat) && matches(q, p.name, p.code, p.barcode, p.brand, p.cars, p.oemNumbers))
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar')).slice(0, 60)
  }, [products, cat, q, carId, carModels])
  const carList = useMemo(() => Array.from(carModels.values()).filter(m => matches(carQ, m.make, m.model, m.engine)).sort((a, b) => carLabel(a).localeCompare(carLabel(b), 'ar')).slice(0, 10), [carModels, carQ])

  const cartCount = items.reduce((n, i) => n + i.qty, 0)
  const customer = customerId ? customers.get(customerId) : undefined

  return (
    <div className="pos">
      <div className="catalog stack">
        {editId && <div className="card pad tone-info" style={{ padding: '10px 14px' }}>تعديل الفاتورة رقم {invoiceNo(sales.get(editId)?.number ?? 0)} — <a href="#" onClick={e => { e.preventDefault(); reset(); nav('/sales') }} style={{ textDecoration: 'underline' }}>إلغاء التعديل</a></div>}
        <ProductSearch onPick={add} autoFocus />
        <div className="between" style={{ flexWrap: 'wrap' }}>
          <Chips value={cat} onChange={setCat} items={[{ id: 'all', label: 'الكل' }, ...catList.map(c => ({ id: c.id, label: c.name }))]} />
          <div className="row" style={{ position: 'relative' }}>
            {carId ? <span className="badge tone-info" style={{ fontSize: 13, padding: '6px 10px' }}><Car /> {carLabel(carModels.get(carId))} <button className="btn ghost icon sm" style={{ minHeight: 0, width: 20, height: 20, padding: 0 }} onClick={() => setCarId(null)}><X size={14} /></button></span>
              : <button className="btn sm ghost" onClick={() => setCarOpen(o => !o)}><Car /> حسب السيارة</button>}
            {carOpen && !carId && <div className="card pad" style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, zIndex: 40, width: 300, marginTop: 4 }}><input className="input" autoFocus placeholder="ابحث عن الموديل…" value={carQ} onChange={e => setCarQ(e.target.value)} /><div className="chips mt">{carList.map(m => <button key={m.id} className="chip" onClick={() => { setCarId(m.id); setCarOpen(false); setCarQ('') }}>{carLabel(m)}</button>)}{carList.length === 0 && <span className="muted small">لا موديلات — أضفها من «دليل السيارات»</span>}</div></div>}
            <button className="btn sm ghost" onClick={() => setAddProduct(true)}><PlusCircle /> قطعة جديدة</button>
          </div>
        </div>
        <div className="input-wrap hide-desktop"><input className="input" placeholder="تصفية القائمة…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="products">
          {grid.map(p => {
            const st = stock.get(p.id) ?? 0
            return (
              <button key={p.id} className={`pcard ${p.kind === 'product' && st <= 0 ? 'out' : ''}`} onClick={() => add(p)}>
                {p.image && <img src={p.image} alt="" style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 8, marginBottom: 4 }} />}
                <div className="n">{p.name}</div>
                <div className="c">{p.code}{p.cars ? ` · ${p.cars}` : ''}</div>
                <div className="between" style={{ marginTop: 'auto' }}>
                  <span className="p"><Price value={wholesale && p.wholesalePrice ? p.wholesalePrice : p.price} /></span>
                  {p.kind === 'product' && <span className={`small ${st <= p.minStock ? 'neg-txt' : 'muted'}`}>{st} {p.unit}</span>}
                </div>
              </button>
            )
          })}
          {grid.length === 0 && <div className="muted" style={{ gridColumn: '1/-1', padding: 20, textAlign: 'center' }}>{products.size === 0 ? 'لا توجد قطع بعد. أضف قطعك من شاشة المنتجات أو بزر «قطعة جديدة».' : carId ? 'لا قطع مربوطة بهذه السيارة بعد' : 'لا نتائج'}</div>}
        </div>
      </div>

      <div className={`cart card pad ${showCart ? '' : 'hide-mobile'}`} style={showCart ? { position: 'fixed', inset: 0, zIndex: 45, overflowY: 'auto', borderRadius: 0 } : undefined}>
        <div className="card-title">
          <h2><ShoppingCart size={18} style={{ verticalAlign: -3 }} /> الفاتورة {editId ? '' : `رقم ${invoiceNo(useStore.getState().sales.size ? Math.max(...Array.from(sales.values()).map(s => s.number)) + 1 : 1)}`}</h2>
          <div className="row">
            <label className="checkbox small" title="استخدام سعر الجملة"><input type="checkbox" checked={wholesale} onChange={e => setWholesale(e.target.checked)} /> جملة</label>
            {items.length > 0 && <button className="btn sm ghost" onClick={() => setItems([])} title="إفراغ"><Trash2 /></button>}
            {showCart && <button className="btn sm" onClick={() => setShowCart(false)}>رجوع</button>}
          </div>
        </div>
        <Field label="العميل">
          <PartyPicker type="customer" value={customerId} onChange={(id, name) => { setCustomerId(id); setCustomerName(name) }} onAddNew={() => setAddCustomer(true)} />
          {customer?.car && <div className="help">السيارة: {customer.car}</div>}
        </Field>
        <div className="items mt">
          {items.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>اختر القطع من القائمة أو امسح الباركود</div>}
          {items.map((it, i) => (
            <div key={i} className="cart-item">
              <div>
                <div className="n">{it.name}</div>
                <div className="m">{it.code}{it.kind === 'product' && it.productId ? ` · متوفر ${stock.get(it.productId) ?? 0}` : ''}</div>
              </div>
              <button className="btn ghost icon sm" onClick={() => removeAt(i)} aria-label="حذف"><Trash2 /></button>
              <div className="row" style={{ gridColumn: '1 / -1', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div className="qty">
                  <button onClick={() => update(i, { qty: Math.max(0, it.qty - 1) })} aria-label="أقل"><Minus size={16} /></button>
                  <input inputMode="decimal" value={it.qty} onChange={e => update(i, { qty: Math.max(0, parseFloat(e.target.value.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))) || 0) })} onFocus={e => e.target.select()} />
                  <button onClick={() => update(i, { qty: it.qty + 1 })} aria-label="أكثر"><Plus size={16} /></button>
                </div>
                <div className="row">
                  <span className="muted small">×</span>
                  <NumberInput value={it.price} onChange={v => update(i, { price: v })} className="sm" />
                  <span className="bold mono" style={{ minWidth: 70, textAlign: 'left' }}>{money(it.qty * it.price - it.discount, { currency: false, display: 'base' })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="totals">
          <div className="line"><span className="muted">المجموع ({num(cartCount, 2)} قطعة)</span><b>{money(subtotal, { display: 'base' })}</b></div>
          <div className="line"><span className="muted"><Percent size={14} style={{ verticalAlign: -2 }} /> خصم</span><div style={{ width: 130 }}><NumberInput value={discount} onChange={setDiscount} suffix={settings.currency} /></div></div>
          <div className="line grand"><span>الإجمالي</span><span>{money(total, { display: 'base' })}</span></div>
          {settings.rate > 0 && <div className="line" style={{ marginTop: -6 }}><span className="muted small">بسعر {settings.rate.toLocaleString('en-US')}</span><span className="muted">{equiv(total)}</span></div>}
          <div className="line"><span className="muted">المدفوع الآن</span><div style={{ width: 150 }}><NumberInput value={paidValue} onChange={v => setPaid(v)} suffix={settings.currency} /></div></div>
          {settings.rate > 0 && <div className="line"><span className="muted small">أو دفع بـ{CURRENCY_SYMBOL[otherCurrency(settings.baseCurrency)]}</span><div style={{ width: 150 }}><NumberInput value={Math.round(convert(paidValue, settings.baseCurrency, otherCurrency(settings.baseCurrency), settings.rate) * 100) / 100} onChange={v => setPaid(Math.round(convert(v, otherCurrency(settings.baseCurrency), settings.baseCurrency, settings.rate) * 100) / 100)} suffix={CURRENCY_SYMBOL[otherCurrency(settings.baseCurrency)]} /></div></div>}
          <div className="btn-row">
            <button className={`btn sm ${paidValue >= total && total > 0 ? 'success' : ''}`} onClick={() => setPaid(null)}><Check /> دفع كامل</button>
            <button className={`btn sm ${paidValue === 0 && total > 0 ? 'danger' : ''}`} onClick={() => setPaid(0)}>آجل (دين)</button>
            {paidValue < total && <span className="badge tone-warning">المتبقي {money(total - paidValue)}</span>}
          </div>
          {seeCost && items.length > 0 && <div className="small muted">الربح المتوقع: {money(items.reduce((s, i) => s + (i.price - i.cost) * i.qty - i.discount, 0) - discount)}</div>}
          <details>
            <summary className="muted small" style={{ cursor: 'pointer' }}>التاريخ والملاحظات</summary>
            <div className="form-grid mt">
              <Field label="التاريخ"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
              <Field label="ملاحظات"><input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="تظهر على الفاتورة" /></Field>
            </div>
          </details>
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button className="btn primary lg" style={{ flex: 1 }} disabled={busy || items.length === 0} onClick={() => save(true)} title="F9"><Printer /> حفظ وطباعة</button>
            <button className="btn lg" disabled={busy || items.length === 0} onClick={() => save(false)} title="F8"><Save /> حفظ</button>
          </div>
        </div>
      </div>

      {!showCart && items.length > 0 && (
        <button className="btn primary lg pos-fab hide-desktop" onClick={() => setShowCart(true)}><ShoppingCart /> الفاتورة ({num(cartCount, 2)}) — {money(total)}</button>
      )}

      {addCustomer && <CustomerForm onClose={() => setAddCustomer(false)} onSaved={c => { setCustomerId(c.id); setCustomerName(c.name) }} />}
      {addProduct && <ProductForm onClose={() => setAddProduct(false)} onSaved={p => add(p)} />}
      {done && <DoneModal sale={done} onNew={() => { reset(); setShowCart(false) }} onClose={() => { reset(); setShowCart(false); if (editId) nav('/sales') }} />}
    </div>
  )
}

export function whatsappLink(sale: Sale, phone: string | undefined, shopName: string, currency: string): string {
  const lines = [`*${shopName}*`, `فاتورة رقم ${invoiceNo(sale.number)} — ${fmtDate(sale.date)}`, `العميل: ${sale.customerName}`, '',
    ...sale.items.map(i => `• ${i.name} × ${num(i.qty, 2)} = ${money(i.qty * i.price - i.discount, { currency: false })}`), '',
    sale.discount ? `الخصم: ${money(sale.discount, { currency: false })}` : '', `*الإجمالي: ${money(sale.total, { currency: false })} ${currency}*`,
    sale.paid < sale.total ? `المدفوع: ${money(sale.paid, { currency: false })} — المتبقي: ${money(sale.total - sale.paid, { currency: false })}` : 'مدفوعة بالكامل'].filter(l => l !== '' || true)
  const text = encodeURIComponent(lines.join('\n'))
  const p = (phone ?? '').replace(/\D/g, '')
  return p ? `https://wa.me/${p.startsWith('0') ? '963' + p.slice(1) : p}?text=${text}` : `https://wa.me/?text=${text}`
}

function DoneModal({ sale, onNew, onClose }: { sale: Sale; onNew: () => void; onClose: () => void }) {
  const settings = useSettings()
  const customers = useCollection('customers')
  const phone = sale.customerId ? customers.get(sale.customerId)?.phone : undefined
  return (
    <Modal title="تم حفظ الفاتورة" onClose={onClose} size="narrow" icon={<Check style={{ color: 'var(--success)' }} />} footer={<>
      <button className="btn primary" onClick={onNew}><PlusCircle /> بيع جديد</button>
      <button className="btn" onClick={onClose}>إغلاق</button>
    </>}>
      <div className="stack">
        <div className="between"><span className="muted">رقم الفاتورة</span><b>{invoiceNo(sale.number)}</b></div>
        <div className="between"><span className="muted">الإجمالي</span><b style={{ fontSize: 20 }}>{money(sale.total)}</b></div>
        {sale.paid < sale.total && <div className="between"><span className="muted">المتبقي على العميل</span><b className="neg-txt">{money(sale.total - sale.paid)}</b></div>}
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="btn" onClick={() => printDocument({ type: 'invoice', sale })}><Printer /> طباعة</button>
          <a className="btn" href={whatsappLink(sale, phone, settings.shopName, settings.currency)} target="_blank" rel="noreferrer"><MessageCircle /> إرسال واتساب</a>
        </div>
      </div>
    </Modal>
  )
}
