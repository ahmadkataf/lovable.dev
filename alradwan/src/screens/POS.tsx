import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { nextNumber } from '../db/actions'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Trash2, Printer, Save, MessageCircle, PlusCircle, Minus, Plus, Check, ShoppingCart, Percent } from 'lucide-react'
import { useCollection, useCanSeeCost, useSettings, usePerm } from '../db/store'
import type { InvoiceItem, Product, Sale } from '../db/types'
import { saveSale } from '../db/actions'
import { saleTotals } from '../lib/calc'
import { CURRENCY_SYMBOL, convert, equiv, fmtDate, fromInputDate, invoiceNo, matches, money, num, otherCurrency, toInputDate, toNumber } from '../lib/format'
import { Field, NumberInput, Chips, Price } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { ProductSearch, PartyPicker, useProductStock } from '../ui/pickers'
import { carLabel, productsForCar } from '../ui/cars'
import { Car, X } from 'lucide-react'
import { CustomerForm, ProductForm } from '../ui/forms'
import { VehiclePicker } from '../ui/vehicles'
import type { Vehicle } from '../db/types'
import { printDocument } from '../print/PrintHost'

// The invoice being typed lives outside the screen: the screen is remounted when the dollar rate changes
// (so every price refreshes) and unmounted when the cashier glances at another screen, and the cart must survive both.
interface Draft { items: InvoiceItem[]; customerId?: string; customerName: string; discount: number; discMode: 'amount' | 'pct'; discPct: number; quote: boolean; job: boolean; paid: number | null; notes: string; wholesale: boolean; vehicleId?: string; odometer: number; nextKm: number; nextDays: number }
const draftStore = create<{ d: Draft | null }>(() => ({ d: null }))

export function POS() {
  const [params, setParams] = useSearchParams()
  const draft = draftStore.getState().d
  const nav = useNavigate()
  const editId = params.get('edit')
  const sales = useCollection('sales')
  const products = useCollection('products')
  const categories = useCollection('categories')
  const customers = useCollection('customers')
  const carModels = useCollection('carModels')
  const settings = useSettings()
  const seeCost = useCanSeeCost()
  const canBackdate = usePerm('backdate'), canQuote = usePerm('quotes'), canEditInv = usePerm('editInvoices'), canAddProduct = usePerm('products'), canAddCustomer = usePerm('customers')
  const stock = useProductStock()
  const toast = useToast(); const confirm = useConfirm()

  const [items, setItems] = useState<InvoiceItem[]>(draft?.items ?? [])
  const [customerId, setCustomerId] = useState<string | undefined>(draft?.customerId)
  const [customerName, setCustomerName] = useState(draft?.customerName ?? 'زبون نقدي')
  const [discount, setDiscount] = useState(draft?.discount ?? 0)
  const [discMode, setDiscMode] = useState<'amount' | 'pct'>(draft?.discMode ?? 'amount')
  const [discPct, setDiscPct] = useState(draft?.discPct ?? 0)
  const [quote, setQuote] = useState(draft?.quote ?? false)   // عرض سعر: يُحفظ ويُطبع لكن لا يمس المخزون ولا الصندوق
  const [job, setJob] = useState(draft?.job ?? false)         // أمر عمل: عرض سعر مفتوح يُغلق لاحقاً كفاتورة
  const [vehicleId, setVehicleId] = useState<string | undefined>(draft?.vehicleId)
  const [odometer, setOdometer] = useState(draft?.odometer ?? 0)
  const [nextKm, setNextKm] = useState(draft?.nextKm ?? 0)
  const [nextDays, setNextDays] = useState(draft?.nextDays ?? 0)
  const [paid, setPaid] = useState<number | null>(draft?.paid ?? null) // null = the whole amount
  const [date, setDate] = useState(toInputDate(Date.now()))
  const [notes, setNotes] = useState(draft?.notes ?? '')
  const [wholesale, setWholesale] = useState(draft?.wholesale ?? false)
  useEffect(() => { if (!editId) draftStore.setState({ d: items.length || customerId ? { items, customerId, customerName, discount, discMode, discPct, quote, job, paid, notes, wholesale, vehicleId, odometer, nextKm, nextDays } : null }) }, [items, customerId, customerName, discount, discMode, discPct, quote, job, paid, notes, wholesale, vehicleId, odometer, nextKm, nextDays, editId])
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

  // keyboard: F2 search, F9 save and print, F8 save (the handler reads the latest save through a ref)
  const saveRef = useRef<(p: boolean) => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); (document.querySelector('.catalog input.input') as HTMLInputElement | null)?.focus() }
      else if (e.key === 'F9') { e.preventDefault(); saveRef.current(true) }
      else if (e.key === 'F8') { e.preventDefault(); saveRef.current(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // editing an existing invoice
  const wasEditing = useRef(false)
  useEffect(() => {
    if (!editId) { if (wasEditing.current) { wasEditing.current = false; reset() } return }
    wasEditing.current = true
    const s = sales.get(editId)
    if (!s) return
    if (!canEditInv) { toast.error('ليس لديك صلاحية تعديل الفواتير'); setParams({}); return }
    setItems(s.items.map(i => ({ ...i }))); setCustomerId(s.customerId); setCustomerName(s.customerName); setDiscount(s.discount); setPaid(s.paid); setDate(toInputDate(canBackdate ? s.date : Date.now())); setNotes(s.notes ?? ''); setQuote(s.type === 'quote'); setJob(!!s.job); setVehicleId(s.vehicleId); setOdometer(s.odometer ?? 0); setNextKm(s.nextServiceKm && s.odometer ? s.nextServiceKm - s.odometer : 0); setNextDays(s.nextServiceDate ? Math.max(0, Math.round((s.nextServiceDate - s.date) / 86400000)) : 0)
    if (s.discountPct) { setDiscMode('pct'); setDiscPct(s.discountPct) } else setDiscMode('amount')
  }, [editId])

  const { subtotal, total } = saleTotals(items, discount)
  const paidValue = paid === null ? total : Math.min(paid, total)

  // the customer's standing discount becomes a percentage discount (the cashier can still change it)
  useEffect(() => {
    if (editId) return
    const c = customerId ? customers.get(customerId) : undefined
    if (c?.discountPct) { setDiscMode('pct'); setDiscPct(c.discountPct) }
  }, [customerId, editId])
  // a percentage discount follows the subtotal as lines change
  useEffect(() => { if (discMode === 'pct') setDiscount(Math.round(subtotal * discPct) / 100) }, [discMode, discPct, subtotal])


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

  const reset = () => { draftStore.setState({ d: null }); setItems([]); setCustomerId(undefined); setCustomerName('زبون نقدي'); setDiscount(0); setDiscMode('amount'); setDiscPct(0); setQuote(false); setJob(false); setVehicleId(undefined); setOdometer(0); setNextKm(0); setNextDays(0); setPaid(null); setDate(toInputDate(Date.now())); setNotes(''); setDone(null); if (editId) setParams({}) }

  const save = async (andPrint: boolean) => {
    if (items.length === 0) { toast.error('أضف قطعة واحدة على الأقل'); return }
    if (items.some(i => i.qty <= 0)) { toast.error('هناك سطر كميته صفر'); return }
    const short = items.filter(i => i.kind === 'product' && i.productId && (stock.get(i.productId) ?? 0) + (editId ? (sales.get(editId)?.items.find(x => x.productId === i.productId)?.qty ?? 0) : 0) < i.qty)
    if (short.length && !quote && !(await confirm({ title: 'الكمية غير متوفرة في المخزون', text: <div>{short.map(i => <div key={i.name}>• {i.name}: المتوفر <span className="mono">{stock.get(i.productId!) ?? 0}</span>، المطلوب <span className="mono">{i.qty}</span></div>)}<p className="mt">هل تريد البيع على أي حال؟ (سيصبح المخزون بالسالب حتى تسجّل الشراء)</p></div>, okText: 'نعم، بيع' }))) return
    if (paidValue < total - 0.004 && !quote && !customerId) { toast.error('فاتورة آجلة بلا عميل: اختر العميل حتى يُسجَّل الدين عليه، أو سجّل الدفع كاملاً'); return }
    setBusy(true)
    try {
      const old = editId ? sales.get(editId) : undefined
      const when = old && toInputDate(old.date) === date ? old.date : fromInputDate(date)
      const sale = await saveSale({ id: old?.id, number: old?.number, type: quote ? 'quote' : 'sale', date: when, customerId, customerName, items, discount, discountPct: discMode === 'pct' ? discPct : undefined, paid: quote ? 0 : paidValue, notes, returnOf: old?.returnOf, validUntil: quote && !job ? when + 7 * 86400000 : undefined, job: quote && job ? true : undefined, jobStatus: quote && job ? (old?.jobStatus ?? 'open') : undefined, vehicleId, odometer: odometer || undefined, nextServiceKm: nextKm && odometer ? odometer + nextKm : undefined, nextServiceDate: nextDays ? when + nextDays * 86400000 : undefined })
      if (andPrint) printDocument({ type: 'invoice', sale })
      setDone(sale)
    } catch (e) { toast.error('تعذّر الحفظ: ' + (e as Error).message) } finally { setBusy(false) }
  }
  saveRef.current = save

  const catList = useMemo(() => Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [categories])
  const grid = useMemo(() => {
    const car = carId ? carModels.get(carId) : undefined
    const all = car ? productsForCar(products.values(), car) : Array.from(products.values())
    const list = all.filter(p => (cat === 'all' || p.categoryId === cat) && matches(q, p.name, p.code, p.barcode, p.brand, p.cars, p.oemNumbers))
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar')).slice(0, 60)
  }, [products, cat, q, carId, carModels])
  const carList = useMemo(() => Array.from(carModels.values()).filter(m => matches(carQ, m.make, m.model, m.engine)).sort((a, b) => carLabel(a).localeCompare(carLabel(b), 'ar')).slice(0, 10), [carModels, carQ])

  const cartCount = items.reduce((n, i) => n + i.qty, 0)
  const nextNo = useMemo(() => nextNumber('sales'), [sales])
  const customer = customerId ? customers.get(customerId) : undefined

  return (
    <div className="pos">
      <div className="catalog stack">
        {editId && <div className="card pad tone-info" style={{ padding: '10px 14px' }}>تعديل الفاتورة رقم {invoiceNo(sales.get(editId)?.number ?? 0)} — <a href="#" onClick={e => { e.preventDefault(); reset(); nav('/sales') }} style={{ textDecoration: 'underline' }}>إلغاء التعديل</a></div>}
        <ProductSearch onPick={add} autoFocus={!isTouch} />
        <div className="between" style={{ flexWrap: 'wrap' }}>
          <Chips value={cat} onChange={setCat} items={[{ id: 'all', label: 'الكل' }, ...catList.map(c => ({ id: c.id, label: c.name }))]} />
          <div className="row" style={{ position: 'relative' }}>
            {carId ? <span className="badge tone-info" style={{ fontSize: 13, padding: '6px 10px' }}><Car /> {carLabel(carModels.get(carId))} <button className="btn ghost icon sm" style={{ minHeight: 0, width: 20, height: 20, padding: 0 }} onClick={() => setCarId(null)}><X size={14} /></button></span>
              : <button className="btn sm ghost" onClick={() => setCarOpen(o => !o)}><Car /> حسب السيارة</button>}
            {carOpen && !carId && <div className="card pad" style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, zIndex: 40, width: 300, marginTop: 4 }}><input className="input" autoFocus placeholder="ابحث عن الموديل…" value={carQ} onChange={e => setCarQ(e.target.value)} /><div className="chips mt">{carList.map(m => <button key={m.id} className="chip" onClick={() => { setCarId(m.id); setCarOpen(false); setCarQ('') }}>{carLabel(m)}</button>)}{carList.length === 0 && <span className="muted small">لا موديلات — أضفها من «دليل السيارات»</span>}</div></div>}
            {canAddProduct && <button className="btn sm ghost" onClick={() => setAddProduct(true)}><PlusCircle /> قطعة جديدة</button>}
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
                  {p.kind === 'product' && <span className={`small ${st <= p.minStock ? 'neg-txt' : 'muted'}`} style={{ whiteSpace: 'nowrap' }}><span className="mono">{st}</span> {p.unit}</span>}
                </div>
              </button>
            )
          })}
          {grid.length === 0 && <div className="muted" style={{ gridColumn: '1/-1', padding: 20, textAlign: 'center' }}>{products.size === 0 ? 'لا توجد قطع بعد. أضف قطعك من شاشة المنتجات أو بزر «قطعة جديدة».' : carId ? 'لا قطع مربوطة بهذه السيارة بعد' : 'لا نتائج'}</div>}
        </div>
      </div>

      <div className={`cart card pad ${showCart ? '' : 'hide-mobile'}`} style={showCart ? { position: 'fixed', inset: 0, zIndex: 45, overflowY: 'auto', borderRadius: 0 } : undefined}>
        <div className="card-title">
          <h2><ShoppingCart size={18} style={{ verticalAlign: -3 }} /> {quote ? (job ? 'أمر عمل' : 'عرض سعر') : 'الفاتورة'} {editId ? '' : `رقم ${invoiceNo(nextNo)}`}</h2>
          <div className="row">
            <label className="checkbox small" title="استخدام سعر الجملة"><input type="checkbox" checked={wholesale} onChange={e => setWholesale(e.target.checked)} /> جملة</label>
            {canQuote && <label className="checkbox small" title="عرض سعر يُطبع للزبون ولا يُنقص المخزون ولا يُسجَّل في الصندوق"><input type="checkbox" checked={quote && !job} onChange={e => { setQuote(e.target.checked); setJob(false) }} /> عرض سعر</label>}
            {canQuote && <label className="checkbox small" title="أمر عمل للسيارة: يبقى مفتوحاً تُضاف إليه القطع والأجور، ثم يُغلق كفاتورة"><input type="checkbox" checked={quote && job} onChange={e => { setQuote(e.target.checked); setJob(e.target.checked) }} /> أمر عمل</label>}
            {items.length > 0 && <button className="btn sm ghost" onClick={async () => { if (await confirm({ title: 'إفراغ الفاتورة؟', text: 'ستُحذف كل الأسطر من السلة.', danger: true, okText: 'إفراغ' })) setItems([]) }} title="إفراغ" aria-label="إفراغ السلة"><Trash2 /></button>}
            {showCart && <button className="btn sm" onClick={() => setShowCart(false)}>رجوع</button>}
          </div>
        </div>
        <Field label="العميل">
          <PartyPicker type="customer" value={customerId} onChange={(id, name) => { setCustomerId(id); setCustomerName(name) }} onAddNew={canAddCustomer ? () => setAddCustomer(true) : undefined} />
          {customer?.car && <div className="help">السيارة: {customer.car}</div>}
        </Field>
        {customerId && <Field label="السيارة"><VehiclePicker customerId={customerId} value={vehicleId} onChange={(v?: Vehicle) => { setVehicleId(v?.id); if (v?.odometer && !odometer) setOdometer(v.odometer) }} /></Field>}
        {vehicleId && <div className="stack" style={{ gap: 6 }}><Field label="العداد الحالي (كم)"><NumberInput value={odometer} onChange={setOdometer} suffix="كم" /></Field><Field label="تذكير الصيانة القادمة بعد" help="بالكيلومترات أو بالأيام؛ اتركه فارغاً بلا تذكير"><div className="grid cols-2 keep2" style={{ gap: 8 }}><NumberInput value={nextKm} onChange={setNextKm} suffix="كم" /><NumberInput value={nextDays} onChange={setNextDays} suffix="يوم" /></div></Field></div>}
        <div className="items mt">
          {items.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>اختر القطع من القائمة أو امسح الباركود</div>}
          {items.map((it, i) => (
            <div key={i} className="cart-item">
              <div>
                <div className="n">{it.name}</div>
                <div className="m">{it.code}{it.kind === 'product' && it.productId ? <> · متوفر <span className="mono">{stock.get(it.productId) ?? 0}</span></> : null}</div>
              </div>
              <button className="btn ghost icon sm" onClick={() => removeAt(i)} aria-label="حذف"><Trash2 /></button>
              <div className="row" style={{ gridColumn: '1 / -1', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div className="qty">
                  <button onClick={() => update(i, { qty: Math.max(0, it.qty - 1) })} aria-label="أقل"><Minus size={16} /></button>
                  <QtyInput value={it.qty} onChange={v => update(i, { qty: v })} />
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
          <div className="line"><span className="muted"><Percent size={14} style={{ verticalAlign: -2 }} /> خصم <button className="btn sm ghost" style={{ minHeight: 0, padding: '2px 8px' }} title="التبديل بين خصم بالمبلغ وخصم بالنسبة" onClick={() => { if (discMode === 'pct') { setDiscMode('amount') } else { setDiscPct(subtotal ? Math.round((discount / subtotal) * 10000) / 100 : 0); setDiscMode('pct') } }}>{discMode === 'pct' ? `${num(discPct, 2)}% ← ${settings.currency}` : `${settings.currency} ← %`}</button></span>
            <div style={{ width: 130 }}>{discMode === 'pct' ? <NumberInput value={discPct} onChange={v => setDiscPct(Math.min(100, Math.max(0, v)))} suffix="%" /> : <NumberInput value={discount} onChange={setDiscount} suffix={settings.currency} />}</div></div>
          <div className="line grand"><span>الإجمالي</span><span>{money(total, { display: 'base' })}</span></div>
          {settings.rate > 0 && <div className="line" style={{ marginTop: -6 }}><span className="muted small">بسعر {settings.rate.toLocaleString('en-US')}</span><span className="muted">{equiv(total)}</span></div>}
          {quote && <div className="card pad tone-info small" style={{ padding: '8px 12px' }}>{job ? 'أمر عمل: يُحفظ مفتوحاً ويمكن تعديله مع تقدم العمل، ولا يمس المخزون أو الصندوق حتى يُغلق كفاتورة من «فواتير المبيعات» ← «أوامر العمل».' : 'عرض سعر: يُحفظ ويُطبع ويُرسل للزبون، ولا يؤثر على المخزون أو الصندوق أو حساب العميل. يمكن تحويله إلى فاتورة لاحقاً من «فواتير المبيعات».'}</div>}
          {!quote && <div className="line"><span className="muted">المدفوع الآن</span><div style={{ width: 150 }}><NumberInput value={paidValue} onChange={v => setPaid(v)} suffix={settings.currency} /></div></div>}
          {!quote && settings.rate > 0 && <div className="line"><span className="muted small">أو دفع بـ{CURRENCY_SYMBOL[otherCurrency(settings.baseCurrency)]}</span><div style={{ width: 150 }}><NumberInput value={Math.round(convert(paidValue, settings.baseCurrency, otherCurrency(settings.baseCurrency), settings.rate) * 100) / 100} onChange={v => setPaid(Math.round(convert(v, otherCurrency(settings.baseCurrency), settings.baseCurrency, settings.rate) * 100) / 100)} suffix={CURRENCY_SYMBOL[otherCurrency(settings.baseCurrency)]} /></div></div>}
          {!quote && <div className="btn-row">
            <button className={`btn sm ${paidValue >= total && total > 0 ? 'success' : ''}`} onClick={() => setPaid(null)}><Check /> دفع كامل</button>
            <button className={`btn sm ${paidValue === 0 && total > 0 ? 'danger' : ''}`} onClick={() => setPaid(0)}>آجل (دين)</button>
            {paidValue < total && <span className="badge tone-warning">المتبقي {money(total - paidValue)}</span>}
          </div>}
          {seeCost && items.length > 0 && <div className="small muted">الربح المتوقع: {money(items.reduce((s, i) => s + (i.price - i.cost) * i.qty - i.discount, 0) - discount)}</div>}
          <details>
            <summary className="muted small" style={{ cursor: 'pointer' }}>التاريخ والملاحظات</summary>
            <div className="form-grid mt">
              <Field label="التاريخ" help={canBackdate ? undefined : 'تغيير التاريخ يحتاج صلاحية من المدير'}><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} disabled={!canBackdate} /></Field>
              <Field label="ملاحظات"><input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="تظهر على الفاتورة" /></Field>
            </div>
          </details>
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button className="btn primary lg" style={{ flex: 1 }} disabled={busy || items.length === 0} onClick={() => save(true)} title="F9"><Printer /> {quote ? (job ? 'حفظ أمر العمل وطباعته' : 'حفظ عرض السعر وطباعته') : 'حفظ وطباعة'}</button>
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

/** The quantity box in the cart: accepts what is typed (including a decimal point and Arabic digits) and only
 *  applies a clean number; an emptied box stays empty until the user types, instead of snapping to 0. */
function QtyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText(String(value)) }, [value])
  return <input inputMode="decimal" value={text} onFocus={e => { focused.current = true; e.target.select() }}
    onChange={e => { const t = e.target.value; setText(t); const n = toNumber(t); if (t.trim() !== '' && Number.isFinite(n)) onChange(Math.max(0, n)) }}
    onBlur={() => { focused.current = false; const n = Math.max(0, toNumber(text)); onChange(n); setText(String(n)) }} />
}

const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

export function whatsappLink(sale: Sale, phone: string | undefined, shopName: string, currency: string): string {
  const lines = [`*${shopName}*`, `${sale.type === 'quote' ? 'عرض سعر' : sale.type === 'return' ? 'مرتجع' : 'فاتورة'} رقم ${invoiceNo(sale.number)} — ${fmtDate(sale.date)}`, `العميل: ${sale.customerName}`, '',
    ...sale.items.map(i => `• ${i.name} × ${num(i.qty, 2)} = ${money(i.qty * i.price - i.discount, { currency: false })}`), '',
    sale.discount ? `الخصم: ${money(sale.discount, { currency: false })}` : '', `*الإجمالي: ${money(sale.total, { currency: false })} ${currency}*`,
    sale.type === 'quote' ? (sale.validUntil ? `العرض صالح حتى ${fmtDate(sale.validUntil)}` : '') : sale.paid < sale.total ? `المدفوع: ${money(sale.paid, { currency: false })} — المتبقي: ${money(sale.total - sale.paid, { currency: false })}` : 'مدفوعة بالكامل'].filter(l => l !== '' || true)
  const text = encodeURIComponent(lines.join('\n'))
  const p = (phone ?? '').replace(/\D/g, '')
  return p ? `https://wa.me/${p.startsWith('0') ? '963' + p.slice(1) : p}?text=${text}` : `https://wa.me/?text=${text}`
}

function DoneModal({ sale, onNew, onClose }: { sale: Sale; onNew: () => void; onClose: () => void }) {
  const settings = useSettings()
  const customers = useCollection('customers')
  const phone = sale.customerId ? customers.get(sale.customerId)?.phone : undefined
  return (
    <Modal title={sale.type === 'quote' ? (sale.job ? 'تم حفظ أمر العمل' : 'تم حفظ عرض السعر') : 'تم حفظ الفاتورة'} onClose={onClose} size="narrow" icon={<Check style={{ color: 'var(--success)' }} />} footer={<>
      <button className="btn primary" onClick={onNew}><PlusCircle /> بيع جديد</button>
      <button className="btn" onClick={onClose}>إغلاق</button>
    </>}>
      <div className="stack">
        <div className="between"><span className="muted">{sale.type === 'quote' ? 'رقم عرض السعر' : 'رقم الفاتورة'}</span><b>{invoiceNo(sale.number)}</b></div>
        <div className="between"><span className="muted">الإجمالي</span><b style={{ fontSize: 20 }}>{money(sale.total)}</b></div>
        {sale.type !== 'quote' && sale.paid < sale.total && <div className="between"><span className="muted">المتبقي على العميل</span><b className="neg-txt">{money(sale.total - sale.paid)}</b></div>}
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="btn" onClick={() => printDocument({ type: 'invoice', sale })}><Printer /> طباعة</button>
          <a className="btn" href={whatsappLink(sale, phone, settings.shopName, settings.currency)} target="_blank" rel="noreferrer"><MessageCircle /> إرسال واتساب</a>
        </div>
      </div>
    </Modal>
  )
}
