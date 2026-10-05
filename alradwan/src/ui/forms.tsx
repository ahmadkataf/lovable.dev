import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, Trash2, ImagePlus, ScanLine, Link2, Globe, RefreshCw } from 'lucide-react'
import { audit, can, put, useCollection, useSettings, useCanSeeCost, useIsAdmin, usePerm } from '../db/store'
import type { Category, Customer, Product, Supplier } from '../db/types'
import { Field, NumberInput } from './components'
import { equiv } from '../lib/format'
import { CarModelPick, CarModelSelect } from './cars'
import { decodeVin, normalizeVin, splitOem } from '../lib/vin'
import { Search } from 'lucide-react'
import { Modal, useConfirm, useIsTopDialog } from './modal'
import { CameraScanner } from './scanner'
import { ProductSearch } from './pickers'
import { focusedField, insertIntoField, SCAN_PRIORITY, useScan } from '../lib/scan'
import { barcodeOwner, barcodeToSave, findProductByScan, withBarcode } from '../lib/productMatch'
import { brandHint, codeFacts, learnBrandPrefixes, parseGs1, publicGtin } from '../lib/gs1'
import { lookupProduct, shareCatalogChanges, SOURCE_LABEL, type LookupSource } from '../lib/productLookup'
import { shrinkImage } from '../lib/image'
import { useToast } from './toast'
import { deleteProduct, remove } from '../db/actions'

// The add/edit dialogs for products, customers and suppliers, shared by every screen that needs them.

export function CustomerForm({ initial, onClose, onSaved }: { initial?: Partial<Customer>; onClose: () => void; onSaved?: (c: Customer) => void }) {
  const [f, setF] = useState<Partial<Customer>>({ name: '', phone: '', car: '', address: '', notes: '', openingBalance: 0, ...initial })
  const [vinBusy, setVinBusy] = useState(false)
  const toast = useToast(); const confirm = useConfirm(); const isAdmin = useIsAdmin()
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Customer, v: unknown) => setF(x => ({ ...x, [k]: v }))
  const save = async () => {
    if (!f.name?.trim()) { toast.error('اكتب اسم العميل'); return }
    if (!can('customers')) { toast.error('ليس لديك صلاحية تعديل العملاء'); return }
    setBusy(true)
    try { const c = await put('customers', { ...(f as Customer), name: f.name.trim(), vin: f.vin ? normalizeVin(f.vin) : undefined, createdAt: f.createdAt ?? Date.now() }); toast.success('تم حفظ العميل'); onSaved?.(c); onClose() }
    catch (e) { toast.error('تعذّر الحفظ: ' + (e as Error).message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!f.id) return
    if (await confirm({ title: 'حذف العميل؟', text: 'تبقى فواتيره كما هي، لكن يختفي من قائمة العملاء.', danger: true, okText: 'حذف' })) { await remove('customers', f.id); toast.success('تم الحذف'); onClose() }
  }
  return (
    <Modal title={f.id ? 'تعديل عميل' : 'عميل جديد'} onClose={onClose} footer={<>
      <button className="btn primary" onClick={save} disabled={busy}><Save /> حفظ</button>
      <button className="btn" onClick={onClose}>إلغاء</button>
      {f.id && isAdmin && <><span className="grow" /><button className="btn danger" onClick={del}><Trash2 /> حذف</button></>}
    </>}>
      <div className="form-grid">
        <Field label="الاسم" required className="full"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></Field>
        <Field label="الهاتف"><input className="input" value={f.phone} onChange={e => set('phone', e.target.value)} inputMode="tel" dir="ltr" style={{ textAlign: 'right' }} /></Field>
        <Field label="السيارة"><input className="input" value={f.car} onChange={e => set('car', e.target.value)} placeholder="مثال: كيا ريو 2015" /></Field>
        <Field label="رقم الشاصي (VIN)" className="full" help="زر القراءة يملأ بيانات السيارة تلقائياً"><div className="row"><input className="input" dir="ltr" style={{ fontFamily: 'monospace', textAlign: 'right' }} value={f.vin ?? ''} onChange={e => set('vin', e.target.value.toUpperCase())} maxLength={20} /><button type="button" className="btn" disabled={vinBusy} onClick={async () => { setVinBusy(true); try { const r = await decodeVin(f.vin ?? ''); if (r.error && !r.make) toast.error(r.error); else { set('vin', r.vin); set('car', [r.make, r.model, r.year].filter(Boolean).join(' ')); if (r.error) toast.error(r.error); else toast.success('تمت قراءة الشاصي') } } finally { setVinBusy(false) } }}><Search /> قراءة</button></div></Field>
        <Field label="الموديل من دليل السيارات" className="full"><CarModelPick value={f.carModelId} onChange={id => set('carModelId', id)} /></Field>
        <Field label="رقم اللوحة"><input className="input" value={f.plate ?? ''} onChange={e => set('plate', e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
        <Field label="خصم دائم (%)" help="يُطبَّق تلقائياً على فواتيره"><NumberInput value={f.discountPct ?? 0} onChange={v => set('discountPct', Math.min(100, v))} min={0} suffix="%" /></Field>
        <Field label="العنوان" className="full"><input className="input" value={f.address} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="دين سابق (عليه)" help="مبلغ كان مديناً به قبل استخدام البرنامج"><NumberInput value={f.openingBalance ?? 0} onChange={v => set('openingBalance', v)} /></Field>
        <Field label="ملاحظات"><input className="input" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

export function SupplierForm({ initial, onClose, onSaved }: { initial?: Partial<Supplier>; onClose: () => void; onSaved?: (s: Supplier) => void }) {
  const [f, setF] = useState<Partial<Supplier>>({ name: '', phone: '', address: '', notes: '', openingBalance: 0, ...initial })
  const toast = useToast(); const confirm = useConfirm(); const isAdmin = useIsAdmin()
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Supplier, v: unknown) => setF(x => ({ ...x, [k]: v }))
  const save = async () => {
    if (!f.name?.trim()) { toast.error('اكتب اسم المورد'); return }
    if (!can('customers')) { toast.error('ليس لديك صلاحية تعديل الموردين'); return }
    setBusy(true)
    try { const s = await put('suppliers', { ...(f as Supplier), name: f.name.trim(), createdAt: f.createdAt ?? Date.now() }); toast.success('تم حفظ المورد'); onSaved?.(s); onClose() }
    catch (e) { toast.error('تعذّر الحفظ: ' + (e as Error).message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!f.id) return
    if (await confirm({ title: 'حذف المورد؟', danger: true, okText: 'حذف' })) { await remove('suppliers', f.id); toast.success('تم الحذف'); onClose() }
  }
  return (
    <Modal title={f.id ? 'تعديل مورد' : 'مورد جديد'} onClose={onClose} footer={<>
      <button className="btn primary" onClick={save} disabled={busy}><Save /> حفظ</button>
      <button className="btn" onClick={onClose}>إلغاء</button>
      {f.id && isAdmin && <><span className="grow" /><button className="btn danger" onClick={del}><Trash2 /> حذف</button></>}
    </>}>
      <div className="form-grid">
        <Field label="الاسم" required className="full"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></Field>
        <Field label="الهاتف"><input className="input" value={f.phone} onChange={e => set('phone', e.target.value)} inputMode="tel" dir="ltr" style={{ textAlign: 'right' }} /></Field>
        <Field label="العنوان"><input className="input" value={f.address} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="دين سابق (له علينا)"><NumberInput value={f.openingBalance ?? 0} onChange={v => set('openingBalance', v)} /></Field>
        <Field label="ملاحظات"><input className="input" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/** The next free internal code: P-0001, P-0002… */
export function nextCode(products: Map<string, Product>): string {
  let max = 0
  for (const p of products.values()) { const m = /^P-?(\d+)$/i.exec(p.code); if (m) max = Math.max(max, parseInt(m[1])) }
  return `P-${String(max + 1).padStart(4, '0')}`
}


/** `scanned`: the code that was scanned to open this form (a new product for it, or the product it matched). */
export function ProductForm({ initial, currentStock, onClose, onSaved, scanned }: { initial?: Partial<Product>; currentStock?: number; onClose: () => void; onSaved?: (p: Product) => void; scanned?: string }) {
  const products = useCollection('products')
  const categories = useCollection('categories')
  const settings = useSettings()
  const seeCost = useCanSeeCost()
  const isAdmin = useIsAdmin()
  const canProducts = usePerm('products'), canPrices = usePerm('editPrices')
  const canEdit = isAdmin || canProducts
  const [f, setF] = useState<Partial<Product>>({ code: nextCode(products), barcode: '', name: '', brand: '', cars: '', unit: settings.units[0] ?? 'قطعة', cost: 0, price: 0, wholesalePrice: 0, minStock: settings.lowStockDefault, openingStock: 0, location: '', notes: '', kind: 'product', ...initial })
  const [newCat, setNewCat] = useState('')
  const toast = useToast(); const confirm = useConfirm()
  // every change the user makes (the automatic lookup must not move the cursor away from someone typing)
  const edits = useRef(0)
  const set = (k: keyof Product, v: unknown) => { edits.current++; setF(x => ({ ...x, [k]: v })) }
  const isNew = !f.id
  const [busy, setBusy] = useState(false)
  const [camera, setCamera] = useState(false)
  const [linking, setLinking] = useState(false)
  const isTop = useIsTopDialog()
  const addBarcode = (text: string) => setF(x => ({ ...x, barcode: withBarcode(x.barcode, barcodeToSave(text)) }))
  // a scan while this form is on top fills the barcode, or the part-number / notes field the cursor is in
  useScan(sc => {
    if (!isTop()) return false
    // looking for the part this new barcode belongs to: its scanned shelf label (or old barcode) picks it
    if (linking) { const hit = findProductByScan(Array.from(products.values()).filter(p => p.id !== f.id), sc.text); if (hit) { void link(hit.product); return true } }
    const el = focusedField()
    const target = el?.dataset.scan
    if (el && target === 'text') insertIntoField(el, sc.text)
    else if (target === 'oem') setF(x => ({ ...x, oemNumbers: withBarcode(x.oemNumbers, sc.text) }))
    else if (target === 'code') setF(x => ({ ...x, code: sc.text }))
    else addBarcode(sc.text)
    return true
  }, { priority: SCAN_PRIORITY.dialog })
  const barcodes = splitOem(f.barcode)
  const owners = useMemo(() => splitOem(f.barcode).map(c => ({ c, p: barcodeOwner(products.values(), c, f.id) })).filter((x): x is { c: string; p: Product } => !!x.p), [f.barcode, products, f.id])
  const lastCode = barcodes[barcodes.length - 1]
  const facts = useMemo(() => (lastCode ? codeFacts(lastCode) : null), [lastCode])
  const gs1 = useMemo(() => (scanned ? parseGs1(scanned)?.filter(x => x.ai !== '01' && x.ai !== '02') : null), [scanned])
  // the product was found by its part number or another form of the code: offer to keep the scanned code
  const scannedMissing = !isNew && !!scanned && !findProductByScan([{ ...(f as Product), oemNumbers: '', code: '' }], scanned)
  // a new barcode fills in the part by itself: name, brand and picture from the shared catalogue or the internet
  const [lookup, setLookup] = useState<{ state: 'idle' | 'looking' | 'found' | 'none'; source?: LookupSource; shops?: number }>({ state: 'idle' })
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  // offline first: the maker (and part number) that the barcode's company prefix gives away
  const applyHint = (code: string) => {
    const h = brandHint(code, learnBrandPrefixes(products.values()))
    if (h) setF(x => ({ ...x, brand: x.brand?.trim() ? x.brand : h.brand, oemNumbers: x.oemNumbers?.trim() || !h.partNumber ? x.oemNumbers : h.partNumber }))
  }
  const fillFrom = async (code: string) => {
    applyHint(code)
    const edited = edits.current, focused = document.activeElement
    setLookup({ state: 'looking' })
    const r = await lookupProduct(code)
    if (!alive.current) return
    if (!r) { setLookup({ state: 'none' }); return }
    const cat = r.category ? Array.from(categories.values()).find(c => c.name.trim().toLowerCase() === r.category!.trim().toLowerCase()) : undefined
    setF(x => ({ ...x, name: x.name?.trim() ? x.name : r.name, brand: x.brand?.trim() ? x.brand : (r.brand ?? x.brand), image: x.image || r.image, categoryId: x.categoryId || cat?.id }))
    setLookup({ state: 'found', source: r.source, shops: r.shops })
    toast.success(`وُجدت بياناتها: ${r.name}`)
    // only the price is left to type
    setTimeout(() => { if (!alive.current || edits.current !== edited || document.activeElement !== focused) return; const el = Array.from(document.querySelectorAll<HTMLInputElement>('.modal .price-field input')).pop(); if (el && !el.disabled) { el.focus(); el.select() } }, 60)
  }
  useEffect(() => {
    if (!isNew || !scanned) return
    if (settings.barcodeLookup !== false && publicGtin(barcodeToSave(scanned))) void fillFrom(barcodeToSave(scanned)); else applyHint(barcodeToSave(scanned))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const link = async (p: Product) => {
    if (!scanned) return
    if (!canEdit) { toast.error('ليس لديك صلاحية تعديل القطع'); return }
    const code = barcodeToSave(scanned)
    try {
      const saved = await put('products', { ...p, barcode: withBarcode(p.barcode, code) })
      await audit('update', `ربط الباركود ${code} بالقطعة ${p.name}`, 'products', p.id)
      toast.success(`تم ربط الباركود بالقطعة «${p.name}»`); void shareCatalogChanges(); onSaved?.(saved); onClose()
    } catch (e) { toast.error('تعذّر الحفظ: ' + (e as Error).message) }
  }
  const save = async () => {
    if (busy) return
    if (!f.name?.trim()) { toast.error('اكتب اسم القطعة'); return }
    const code = (f.code ?? '').trim() || nextCode(products)
    const dup = Array.from(products.values()).find(p => p.id !== f.id && p.code.toLowerCase() === code.toLowerCase())
    if (dup) { toast.error(`الكود ${code} مستخدم للقطعة «${dup.name}»`); return }
    if (!canEdit) { toast.error('ليس لديك صلاحية تعديل القطع'); return }
    if (owners.length && !(await confirm({ title: 'باركود مكرر', text: `الباركود ${owners[0].c} مسجّل للقطعة «${owners[0].p.name}». عند مسحه سيظهر أول قطعة تحمله. الحفظ على أي حال؟`, okText: 'حفظ' }))) return
    let categoryId = f.categoryId
    if (newCat.trim()) { const c = await put('categories', { name: newCat.trim() } as Category); categoryId = c.id }
    const before = initial?.id ? products.get(initial.id) : undefined
    setBusy(true)
    try {
    const p = await put('products', { ...(f as Product), code, name: f.name.trim(), categoryId, openingCost: isNew ? (f.cost ?? 0) : f.openingCost, createdAt: f.createdAt ?? Date.now() })
    const changes = before ? [before.price !== p.price ? `سعر البيع ${before.price} ← ${p.price}` : '', before.cost !== p.cost ? `الكلفة ${before.cost} ← ${p.cost}` : '', before.name !== p.name ? `الاسم ${before.name} ← ${p.name}` : ''].filter(Boolean).join('، ') : ''
    await audit(isNew ? 'create' : 'update', isNew ? `إضافة قطعة ${p.name} (${p.code}) بسعر ${p.price}` : `تعديل قطعة ${p.name}${changes ? ': ' + changes : ''}`, 'products', p.id)
    toast.success(isNew ? 'تمت إضافة القطعة' : 'تم حفظ التعديلات'); void shareCatalogChanges(); onSaved?.(p); onClose()
    } catch (e) { toast.error('تعذّر الحفظ: ' + (e as Error).message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!f.id) return
    if (await confirm({ title: 'حذف القطعة؟', text: 'ستُحذف من المخزون. الفواتير القديمة تبقى كما هي.', danger: true, okText: 'حذف' })) { try { await deleteProduct(f.id); toast.success('تم الحذف'); onClose() } catch (e) { toast.error((e as Error).message) } }
  }
  const cats = Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  return (
    <Modal title={isNew ? 'قطعة جديدة' : 'تعديل قطعة'} onClose={onClose} size="wide" footer={<>
      <button className="btn primary" onClick={save} disabled={busy}><Save /> حفظ</button>
      <button className="btn" onClick={onClose}>إلغاء</button>
      {!isNew && isAdmin && <><span className="grow" /><button className="btn danger" onClick={del}><Trash2 /> حذف</button></>}
    </>}>
      {!canEdit && <div className="badge tone-warning mb">ليس لديك صلاحية تعديل القطع والأسعار — للعرض فقط</div>}
      {isNew && scanned && canEdit && <div className="card pad tone-info mb" style={{ padding: '10px 14px' }}>
        <div>باركود غير مسجّل: <b className="mono" dir="ltr">{scanned.length > 60 ? scanned.slice(0, 60) + '…' : scanned}</b>{lookup.state === 'idle' ? ' — اكتب اسم القطعة وسعرها ثم احفظ.' : ''}</div>
        {lookup.state === 'looking' && <div className="mt"><RefreshCw size={14} className="spin" style={{ verticalAlign: -2 }} /> جارٍ البحث عن اسم القطعة وصورتها على الإنترنت…</div>}
        {lookup.state === 'found' && <div className="mt"><Globe size={14} style={{ verticalAlign: -2 }} /> وُجدت بياناتها لدى {SOURCE_LABEL[lookup.source ?? 'openfoodfacts']}{lookup.shops && lookup.shops > 1 ? ` (${lookup.shops} محلات)` : ''}. راجع الاسم وأدخل السعر ثم احفظ.</div>}
        {lookup.state === 'none' && <div className="mt">لم نجد هذه القطعة في قواعد البيانات. اكتب اسمها مرة واحدة{settings.shareCatalog !== false ? '، فتظهر جاهزة لأي محل يمسحها بعدك' : ''}. <a href={`https://www.google.com/search?q=${encodeURIComponent(barcodeToSave(scanned))}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>ابحث عنه في جوجل</a></div>}
        {linking ? <div className="mt"><ProductSearch placeholder="ابحث عن القطعة الموجودة لربط الباركود بها…" onPick={link} autoFocus showStock={false} /></div>
          : <button className="btn sm ghost mt" onClick={() => setLinking(true)}><Link2 /> القطعة موجودة عندي بلا باركود؟ اربطه بها</button>}
      </div>}
      {scannedMissing && canEdit && <div className="card pad tone-info mb" style={{ padding: '10px 14px' }}>
        قُرئ الرمز <b className="mono" dir="ltr">{scanned}</b> وتعرّفنا على القطعة برقمها. <button className="btn sm ghost" onClick={() => addBarcode(scanned!)}><ScanLine /> احفظه باركوداً لها</button>
      </div>}
      <div className="form-grid">
        <Field label="النوع" className="full">
          <div className="tabs small"><button className={f.kind === 'product' ? 'active' : ''} onClick={() => set('kind', 'product')}>قطعة (لها مخزون)</button><button className={f.kind === 'service' ? 'active' : ''} onClick={() => set('kind', 'service')}>خدمة / أجرة عمل</button></div>
        </Field>
        <Field label="الاسم" required className="full"><input className="input lg" value={f.name} onChange={e => set('name', e.target.value)} autoFocus placeholder="مثال: فلتر زيت" /></Field>
        <Field label="الكود / رقم القطعة" help="رقمك الداخلي للقطعة (أو رقم المورد) تكتبه بنفسك؛ يُولَّد تلقائياً إن تركته"><input className="input" value={f.code} onChange={e => set('code', e.target.value)} dir="ltr" style={{ textAlign: 'right' }} data-scan="code" /></Field>
        <Field label="الباركود" help="امسح الباركود المطبوع على العلبة بالقارئ أو بزر الكاميرا وهذه النافذة مفتوحة، فيُكتب هنا وحده. أي نوع: EAN/UPC، Code 128، QR، Data Matrix… وعدة باركودات تُفصل بفاصلة">
          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <input className="input" value={f.barcode} onChange={e => set('barcode', e.target.value)} dir="ltr" style={{ textAlign: 'right', flex: 1, minWidth: 0 }} inputMode="numeric" />
            <button type="button" className="btn icon" title="مسح الباركود بالكاميرا" aria-label="مسح الباركود بالكاميرا" onClick={() => setCamera(true)}><ScanLine /></button>
          </div>
          {facts?.gtin && (publicGtin(lastCode) ? <div className="help">رقم منتج دولي صحيح{facts.country ? ` · مسجّل لدى GS1 ${facts.country}` : ''}{facts.origin ? ` · المنشأ: ${facts.origin}` : ''}</div>
            : <div className="help">رمز داخلي (للمتجر أو الميزان) — ليس رقماً دولياً</div>)}
          {isNew && !scanned && canEdit && lastCode && publicGtin(lastCode) && lookup.state !== 'looking' && <button type="button" className="btn sm ghost" style={{ marginTop: 4 }} onClick={() => fillFrom(lastCode)}><Globe /> {lookup.state === 'none' ? 'لم تُوجد — حاول مجدداً' : 'املأ الاسم والصورة من الإنترنت'}</button>}
          {isNew && !scanned && lookup.state === 'looking' && <div className="help"><RefreshCw size={12} className="spin" /> جارٍ البحث…</div>}
          {facts && !facts.gtin && /^\d{12,14}$/.test(lastCode.replace(/[\s-]/g, '')) && <div className="help neg-txt">رقم التحقق (آخر رقم) لا يطابق — تأكد من الباركود</div>}
          {gs1 && gs1.length > 0 && <div className="help">{gs1.map(x => `${x.label}: ${x.value}`).join(' · ')}</div>}
          {owners.map(({ c, p }) => <div key={c} className="help neg-txt">الباركود {c} مسجّل للقطعة «{p.name}»</div>)}
        </Field>
        <Field label="التصنيف">
          <select className="select" value={f.categoryId ?? ''} onChange={e => { set('categoryId', e.target.value || undefined); setNewCat('') }}>
            <option value="">بدون تصنيف</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new">+ تصنيف جديد…</option>
          </select>
          {f.categoryId === '__new' && <input className="input" style={{ marginTop: 6 }} placeholder="اسم التصنيف الجديد" value={newCat} onChange={e => setNewCat(e.target.value)} autoFocus />}
        </Field>
        <Field label="الماركة / الشركة"><input className="input" value={f.brand} onChange={e => set('brand', e.target.value)} placeholder="Bosch, TRW…" /></Field>
        <Field label="تناسب الموديلات (من دليل السيارات)" className="full" help="اربط القطعة بالموديلات فتظهر عند البحث بالشاصي أو اختيار السيارة"><CarModelSelect value={f.carModelIds ?? []} onChange={ids => set('carModelIds', ids)} /></Field>
        <Field label="تناسب السيارات (نص حر)" className="full"><input className="input" value={f.cars} onChange={e => set('cars', e.target.value)} placeholder="مثال: كيا ريو 2012–2017، هيونداي أكسنت" /></Field>
        <Field label="أرقام القطعة الأصلية (OEM) والبديلة" className="full" help="افصل بين الأرقام بفاصلة؛ يبحث البرنامج بها في شاشة البيع"><input className="input" dir="ltr" style={{ textAlign: 'right', fontFamily: 'monospace' }} value={f.oemNumbers ?? ''} onChange={e => set('oemNumbers', e.target.value)} placeholder="26300-35503, 26300-35504" data-scan="oem" /></Field>
        {seeCost && <Field label="سعر الشراء (الكلفة)" help={equiv(f.cost ?? 0) || undefined}><NumberInput value={f.cost ?? 0} onChange={v => set('cost', v)} min={0} suffix={settings.currency} disabled={!canEdit || !(canPrices || isNew)} /></Field>}
        <Field label="سعر البيع" required className="price-field" help={!canPrices && !isNew ? 'تعديل الأسعار يحتاج صلاحية من المدير' : equiv(f.price ?? 0) || undefined}><NumberInput value={f.price ?? 0} onChange={v => set('price', v)} min={0} suffix={settings.currency} disabled={!canEdit || !(canPrices || isNew)} /></Field>
        <Field label="سعر الجملة" help="يظهر كخيار عند البيع"><NumberInput value={f.wholesalePrice ?? 0} onChange={v => set('wholesalePrice', v)} min={0} suffix={settings.currency} disabled={!canEdit || !(canPrices || isNew)} /></Field>
        <Field label="الوحدة">
          <select className="select" value={f.unit} onChange={e => set('unit', e.target.value)}>{Array.from(new Set([...(settings.units ?? []), f.unit ?? 'قطعة'])).map(u => <option key={u} value={u}>{u}</option>)}</select>
        </Field>
        {f.kind === 'product' && <>
          {isNew ? <Field label="الكمية الحالية في المحل"><NumberInput value={f.openingStock ?? 0} onChange={v => set('openingStock', v)} min={0} /></Field>
            : <Field label="الكمية الحالية" help="تُعدَّل من شاشة المخزون (جرد)"><input className="input" value={currentStock ?? 0} disabled /></Field>}
          <Field label="حد التنبيه" help="ينبّهك عندما تنزل الكمية إليه"><NumberInput value={f.minStock ?? 0} onChange={v => set('minStock', v)} min={0} /></Field>
          <Field label="مكان القطعة في المحل"><input className="input" value={f.location} onChange={e => set('location', e.target.value)} placeholder="رف A3" /></Field>
        </>}
        <Field label="ملاحظات" className="full"><input className="input" value={f.notes} onChange={e => set('notes', e.target.value)} data-scan="text" /></Field>
        <Field label="صورة (اختياري)" className="full">
          <div className="row">
            {f.image && <img src={f.image} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10 }} />}
            <label className="btn sm"><ImagePlus /> {f.image ? 'تغيير الصورة' : 'إضافة صورة'}<input type="file" accept="image/*" hidden onChange={async e => { const file = e.target.files?.[0]; if (file) set('image', await shrinkImage(file)) }} /></label>
            {f.image && <button className="btn sm ghost" onClick={() => set('image', undefined)}>إزالة</button>}
          </div>
        </Field>
      </div>
      {camera && <CameraScanner onClose={() => setCamera(false)} onCode={d => { addBarcode(d.text) }} hint="وجّه الكاميرا نحو باركود القطعة فيُضاف إلى حقل الباركود." />}
    </Modal>
  )
}
