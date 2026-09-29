import { useState } from 'react'
import { Save, Trash2, ImagePlus } from 'lucide-react'
import { audit, put, useCollection, useSettings, useCanSeeCost, useIsAdmin } from '../db/store'
import type { Category, Customer, Product, Supplier } from '../db/types'
import { Field, NumberInput } from './components'
import { equiv } from '../lib/format'
import { Modal, useConfirm } from './modal'
import { useToast } from './toast'
import { deleteProduct, remove } from '../db/actions'

// The add/edit dialogs for products, customers and suppliers, shared by every screen that needs them.

export function CustomerForm({ initial, onClose, onSaved }: { initial?: Partial<Customer>; onClose: () => void; onSaved?: (c: Customer) => void }) {
  const [f, setF] = useState<Partial<Customer>>({ name: '', phone: '', car: '', address: '', notes: '', openingBalance: 0, ...initial })
  const toast = useToast(); const confirm = useConfirm(); const isAdmin = useIsAdmin()
  const set = (k: keyof Customer, v: unknown) => setF(x => ({ ...x, [k]: v }))
  const save = async () => {
    if (!f.name?.trim()) { toast.error('اكتب اسم العميل'); return }
    const c = await put('customers', { ...(f as Customer), name: f.name.trim(), createdAt: f.createdAt ?? Date.now() })
    toast.success('تم حفظ العميل'); onSaved?.(c); onClose()
  }
  const del = async () => {
    if (!f.id) return
    if (await confirm({ title: 'حذف العميل؟', text: 'تبقى فواتيره كما هي، لكن يختفي من قائمة العملاء.', danger: true, okText: 'حذف' })) { await remove('customers', f.id); toast.success('تم الحذف'); onClose() }
  }
  return (
    <Modal title={f.id ? 'تعديل عميل' : 'عميل جديد'} onClose={onClose} footer={<>
      <button className="btn primary" onClick={save}><Save /> حفظ</button>
      <button className="btn" onClick={onClose}>إلغاء</button>
      {f.id && isAdmin && <><span className="grow" /><button className="btn danger" onClick={del}><Trash2 /> حذف</button></>}
    </>}>
      <div className="form-grid">
        <Field label="الاسم" required className="full"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></Field>
        <Field label="الهاتف"><input className="input" value={f.phone} onChange={e => set('phone', e.target.value)} inputMode="tel" dir="ltr" style={{ textAlign: 'right' }} /></Field>
        <Field label="السيارة"><input className="input" value={f.car} onChange={e => set('car', e.target.value)} placeholder="مثال: كيا ريو 2015" /></Field>
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
  const set = (k: keyof Supplier, v: unknown) => setF(x => ({ ...x, [k]: v }))
  const save = async () => {
    if (!f.name?.trim()) { toast.error('اكتب اسم المورد'); return }
    const s = await put('suppliers', { ...(f as Supplier), name: f.name.trim(), createdAt: f.createdAt ?? Date.now() })
    toast.success('تم حفظ المورد'); onSaved?.(s); onClose()
  }
  const del = async () => {
    if (!f.id) return
    if (await confirm({ title: 'حذف المورد؟', danger: true, okText: 'حذف' })) { await remove('suppliers', f.id); toast.success('تم الحذف'); onClose() }
  }
  return (
    <Modal title={f.id ? 'تعديل مورد' : 'مورد جديد'} onClose={onClose} footer={<>
      <button className="btn primary" onClick={save}><Save /> حفظ</button>
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

function nextCode(products: Map<string, Product>): string {
  let max = 0
  for (const p of products.values()) { const m = /^P-?(\d+)$/i.exec(p.code); if (m) max = Math.max(max, parseInt(m[1])) }
  return `P-${String(max + 1).padStart(4, '0')}`
}

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image(); img.src = url
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
    const max = 320; const k = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8)
  } finally { URL.revokeObjectURL(url) }
}

export function ProductForm({ initial, currentStock, onClose, onSaved }: { initial?: Partial<Product>; currentStock?: number; onClose: () => void; onSaved?: (p: Product) => void }) {
  const products = useCollection('products')
  const categories = useCollection('categories')
  const settings = useSettings()
  const seeCost = useCanSeeCost()
  const isAdmin = useIsAdmin()
  const canEdit = isAdmin || settings.staffEditsPrices
  const [f, setF] = useState<Partial<Product>>({ code: nextCode(products), barcode: '', name: '', brand: '', cars: '', unit: settings.units[0] ?? 'قطعة', cost: 0, price: 0, wholesalePrice: 0, minStock: settings.lowStockDefault, openingStock: 0, location: '', notes: '', kind: 'product', ...initial })
  const [newCat, setNewCat] = useState('')
  const toast = useToast(); const confirm = useConfirm()
  const set = (k: keyof Product, v: unknown) => setF(x => ({ ...x, [k]: v }))
  const isNew = !f.id
  const save = async () => {
    if (!f.name?.trim()) { toast.error('اكتب اسم القطعة'); return }
    const code = (f.code ?? '').trim() || nextCode(products)
    const dup = Array.from(products.values()).find(p => p.id !== f.id && p.code.toLowerCase() === code.toLowerCase())
    if (dup) { toast.error(`الكود ${code} مستخدم للقطعة «${dup.name}»`); return }
    let categoryId = f.categoryId
    if (newCat.trim()) { const c = await put('categories', { name: newCat.trim() } as Category); categoryId = c.id }
    if (!canEdit) { toast.error('ليس لديك صلاحية تعديل القطع'); return }
    const before = initial?.id ? products.get(initial.id) : undefined
    const p = await put('products', { ...(f as Product), code, name: f.name.trim(), categoryId, createdAt: f.createdAt ?? Date.now() })
    const changes = before ? [before.price !== p.price ? `سعر البيع ${before.price} ← ${p.price}` : '', before.cost !== p.cost ? `الكلفة ${before.cost} ← ${p.cost}` : '', before.name !== p.name ? `الاسم ${before.name} ← ${p.name}` : ''].filter(Boolean).join('، ') : ''
    await audit(isNew ? 'create' : 'update', isNew ? `إضافة قطعة ${p.name} (${p.code}) بسعر ${p.price}` : `تعديل قطعة ${p.name}${changes ? ': ' + changes : ''}`, 'products', p.id)
    toast.success(isNew ? 'تمت إضافة القطعة' : 'تم حفظ التعديلات'); onSaved?.(p); onClose()
  }
  const del = async () => {
    if (!f.id) return
    if (await confirm({ title: 'حذف القطعة؟', text: 'ستُحذف من المخزون. الفواتير القديمة تبقى كما هي.', danger: true, okText: 'حذف' })) { await deleteProduct(f.id); toast.success('تم الحذف'); onClose() }
  }
  const cats = Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  return (
    <Modal title={isNew ? 'قطعة جديدة' : 'تعديل قطعة'} onClose={onClose} size="wide" footer={<>
      <button className="btn primary" onClick={save}><Save /> حفظ</button>
      <button className="btn" onClick={onClose}>إلغاء</button>
      {!isNew && isAdmin && <><span className="grow" /><button className="btn danger" onClick={del}><Trash2 /> حذف</button></>}
    </>}>
      {!canEdit && <div className="badge tone-warning mb">ليس لديك صلاحية تعديل القطع والأسعار — للعرض فقط</div>}
      <div className="form-grid">
        <Field label="النوع" className="full">
          <div className="tabs small"><button className={f.kind === 'product' ? 'active' : ''} onClick={() => set('kind', 'product')}>قطعة (لها مخزون)</button><button className={f.kind === 'service' ? 'active' : ''} onClick={() => set('kind', 'service')}>خدمة / أجرة عمل</button></div>
        </Field>
        <Field label="الاسم" required className="full"><input className="input lg" value={f.name} onChange={e => set('name', e.target.value)} autoFocus placeholder="مثال: فلتر زيت" /></Field>
        <Field label="الكود / رقم القطعة" help="يُولَّد تلقائياً إن تركته"><input className="input" value={f.code} onChange={e => set('code', e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
        <Field label="الباركود" help="امسحه بالقارئ وهو في هذا الحقل"><input className="input" value={f.barcode} onChange={e => set('barcode', e.target.value)} dir="ltr" style={{ textAlign: 'right' }} inputMode="numeric" /></Field>
        <Field label="التصنيف">
          <select className="select" value={f.categoryId ?? ''} onChange={e => { set('categoryId', e.target.value || undefined); setNewCat('') }}>
            <option value="">بدون تصنيف</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new">+ تصنيف جديد…</option>
          </select>
          {f.categoryId === '__new' && <input className="input" style={{ marginTop: 6 }} placeholder="اسم التصنيف الجديد" value={newCat} onChange={e => setNewCat(e.target.value)} autoFocus />}
        </Field>
        <Field label="الماركة / الشركة"><input className="input" value={f.brand} onChange={e => set('brand', e.target.value)} placeholder="Bosch, TRW…" /></Field>
        <Field label="تناسب السيارات" className="full"><input className="input" value={f.cars} onChange={e => set('cars', e.target.value)} placeholder="مثال: كيا ريو 2012–2017، هيونداي أكسنت" /></Field>
        {seeCost && <Field label="سعر الشراء (الكلفة)" help={equiv(f.cost ?? 0) || undefined}><NumberInput value={f.cost ?? 0} onChange={v => set('cost', v)} min={0} suffix={settings.currency} disabled={!canEdit} /></Field>}
        <Field label="سعر البيع" required help={equiv(f.price ?? 0) || undefined}><NumberInput value={f.price ?? 0} onChange={v => set('price', v)} min={0} suffix={settings.currency} disabled={!canEdit} /></Field>
        <Field label="سعر الجملة" help="يظهر كخيار عند البيع"><NumberInput value={f.wholesalePrice ?? 0} onChange={v => set('wholesalePrice', v)} min={0} suffix={settings.currency} disabled={!canEdit} /></Field>
        <Field label="الوحدة">
          <select className="select" value={f.unit} onChange={e => set('unit', e.target.value)}>{Array.from(new Set([...(settings.units ?? []), f.unit ?? 'قطعة'])).map(u => <option key={u} value={u}>{u}</option>)}</select>
        </Field>
        {f.kind === 'product' && <>
          {isNew ? <Field label="الكمية الحالية في المحل"><NumberInput value={f.openingStock ?? 0} onChange={v => set('openingStock', v)} min={0} /></Field>
            : <Field label="الكمية الحالية" help="تُعدَّل من شاشة المخزون (جرد)"><input className="input" value={currentStock ?? 0} disabled /></Field>}
          <Field label="حد التنبيه" help="ينبّهك عندما تنزل الكمية إليه"><NumberInput value={f.minStock ?? 0} onChange={v => set('minStock', v)} min={0} /></Field>
          <Field label="مكان القطعة في المحل"><input className="input" value={f.location} onChange={e => set('location', e.target.value)} placeholder="رف A3" /></Field>
        </>}
        <Field label="ملاحظات" className="full"><input className="input" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        <Field label="صورة (اختياري)" className="full">
          <div className="row">
            {f.image && <img src={f.image} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10 }} />}
            <label className="btn sm"><ImagePlus /> {f.image ? 'تغيير الصورة' : 'إضافة صورة'}<input type="file" accept="image/*" hidden onChange={async e => { const file = e.target.files?.[0]; if (file) set('image', await shrinkImage(file)) }} /></label>
            {f.image && <button className="btn sm ghost" onClick={() => set('image', undefined)}>إزالة</button>}
          </div>
        </Field>
      </div>
    </Modal>
  )
}
