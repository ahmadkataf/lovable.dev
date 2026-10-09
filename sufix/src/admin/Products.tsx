import React, { useEffect, useMemo, useState } from 'react'
import type { Category, IllustrationKey, Product } from '@shared/types'
import { DJI_DRONES, DJI_SERIES } from '@shared/dji'
import { navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { compressImage, fmtMoney } from '../lib/format'
import { Icon } from '../components/Icons'
import { Illustration, ILLUSTRATION_KEYS, ILLUSTRATION_LABEL, ProductImage } from '../components/Illustrations'
import { Confirm, Empty, Field, Modal, Spinner } from '../components/ui'

const blank = (): Partial<Product> => ({ name: '', brand: 'DJI', category: '', compatible: [], price: 0, stock: 1, short: '', description: '', specs: [], images: [], illustration: 'box', featured: false, active: true, tags: [] })

export function IllustrationPicker({ value, onChange }: { value: IllustrationKey; onChange: (k: IllustrationKey) => void }) {
  return (
    <div className="chip-list">
      {ILLUSTRATION_KEYS.map(k => <button type="button" key={k} className={`chip row ${value === k ? 'on' : ''}`} onClick={() => onChange(k)} title={ILLUSTRATION_LABEL[k]}><span style={{ width: 22, height: 22, display: 'inline-block' }}><Illustration name={k} /></span>{ILLUSTRATION_LABEL[k]}</button>)}
    </div>
  )
}

export function ImageUploader({ images, onChange, max = 8 }: { images: string[]; onChange: (imgs: string[]) => void; max?: number }) {
  const { toast } = useStore()
  const [busy, setBusy] = useState(false)
  const add = async (files: FileList | null) => {
    if (!files) return
    setBusy(true)
    const out = [...images]
    for (const f of Array.from(files).slice(0, max - images.length)) {
      try { out.push(await api.uploadImage(await compressImage(f))) } catch (e) { toast((e as Error).message || 'تعذّر رفع الصورة', 'err') }
    }
    onChange(out); setBusy(false)
  }
  return (
    <div className="stack">
      <div className="thumbs-row">
        {images.map((src, i) => <div key={i} className="th"><img src={src} alt="" /><button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))}>✕</button></div>)}
        {images.length < max && <label className="th upload" style={{ display: 'grid', placeItems: 'center', padding: 0, fontSize: 11 }}><input type="file" accept="image/*" multiple hidden onChange={e => add(e.target.files)} />{busy ? '…' : <><Icon.Upload style={{ width: 20, height: 20 }} />رفع</>}</label>}
      </div>
      <span className="hint">تُصغَّر الصور تلقائياً. الصورة الأولى هي الرئيسية — اسحب لإعادة الترتيب غير متاح، احذف وأعد الرفع.</span>
    </div>
  )
}

function ProductEditor({ initial, categories, onClose, onSaved }: { initial: Partial<Product>; categories: Category[]; onClose: () => void; onSaved: (p: Product) => void }) {
  const { toast } = useStore()
  const [p, setP] = useState<Partial<Product>>({ ...blank(), ...initial })
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'main' | 'details' | 'compat' | 'media'>('main')
  const [series, setSeries] = useState('')
  const u = <K extends keyof Product>(k: K, v: Product[K]) => setP(x => ({ ...x, [k]: v }))
  const save = async () => {
    if (!p.name?.trim()) return toast('اسم المنتج مطلوب', 'err')
    if (!p.category) return toast('اختر القسم', 'err')
    setBusy(true)
    try { const saved = await api.admin.saveProduct(p); onSaved(saved); toast('تم الحفظ') } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const specs = p.specs || []
  const compat = p.compatible || []
  return (
    <Modal title={p.id ? 'تعديل المنتج' : 'منتج جديد'} onClose={onClose} wide footer={<><button className="btn btn-ghost" onClick={onClose}>إلغاء</button><button className="btn btn-primary" disabled={busy} onClick={save}><Icon.Check />{busy ? '…' : 'حفظ المنتج'}</button></>}>
      <div className="tabs">
        {([['main', 'الأساسيات'], ['details', 'الوصف والمواصفات'], ['compat', 'التوافق'], ['media', 'الصور']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'main' && (
        <div className="form-grid">
          <Field label="اسم المنتج *" span2><input className="input" value={p.name || ''} onChange={e => u('name', e.target.value)} /></Field>
          <Field label="القسم *"><select className="select" value={p.category || ''} onChange={e => u('category', e.target.value)}><option value="">اختر…</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="الماركة"><input className="input" value={p.brand || ''} onChange={e => u('brand', e.target.value)} list="brands" /><datalist id="brands"><option>DJI</option><option>Apple</option><option>Samsung</option><option>Xiaomi</option><option>SanDisk</option><option>Autel</option></datalist></Field>
          <Field label="السعر *"><input className="input num" type="number" min={0} step="0.01" value={p.price ?? 0} onChange={e => u('price', Number(e.target.value))} /></Field>
          <Field label="السعر قبل الخصم (اختياري)"><input className="input num" type="number" min={0} step="0.01" value={p.oldPrice ?? ''} onChange={e => u('oldPrice', e.target.value ? Number(e.target.value) : undefined)} /></Field>
          <Field label="الكمية المتوفرة"><input className="input num" type="number" min={0} value={p.stock ?? 0} onChange={e => u('stock', Number(e.target.value))} /></Field>
          <Field label="رمز المنتج SKU"><input className="input num" value={p.sku || ''} onChange={e => u('sku', e.target.value)} /></Field>
          <Field label="وصف قصير (يظهر في البطاقة)" span2><input className="input" value={p.short || ''} onChange={e => u('short', e.target.value)} maxLength={300} /></Field>
          <Field label="وسوم (مفصولة بفاصلة)" hint="مثال: جديد، الأكثر مبيعاً، قطعة أصلية"><input className="input" value={(p.tags || []).join('، ')} onChange={e => u('tags', e.target.value.split(/[،,]/).map(s => s.trim()).filter(Boolean))} /></Field>
          <div className="field"><label>الخيارات</label><div className="stack" style={{ gap: 8 }}><label className="check"><input type="checkbox" checked={!!p.featured} onChange={e => u('featured', e.target.checked)} />منتج مميّز (يظهر في الصفحة الرئيسية)</label><label className="check"><input type="checkbox" checked={p.active !== false} onChange={e => u('active', e.target.checked)} />ظاهر في المتجر</label></div></div>
        </div>
      )}
      {tab === 'details' && (
        <div className="stack">
          <Field label="الوصف الكامل"><textarea className="textarea" style={{ minHeight: 160 }} value={p.description || ''} onChange={e => u('description', e.target.value)} /></Field>
          <div className="field"><label>المواصفات</label>
            <div className="list-editor">
              {specs.map((s, i) => <div key={i} className="item" style={{ gridTemplateColumns: '1fr 1.5fr auto', alignItems: 'center' }}><input className="input input-sm" placeholder="الخاصية" value={s.label} onChange={e => u('specs', specs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} /><input className="input input-sm" placeholder="القيمة" value={s.value} onChange={e => u('specs', specs.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} /><button className="btn btn-ghost btn-sm" onClick={() => u('specs', specs.filter((_, k) => k !== i))}><Icon.Trash /></button></div>)}
              <button className="btn btn-outline btn-sm" onClick={() => u('specs', [...specs, { label: '', value: '' }])}><Icon.Plus />إضافة مواصفة</button>
            </div>
          </div>
        </div>
      )}
      {tab === 'compat' && (
        <div className="stack">
          <p className="hint">حدّد طرازات DJI التي تتوافق معها هذه القطعة، فتظهر في صفحة الطراز وفي تصفية المتجر.</p>
          <div className="chip-list"><button className={`chip ${!series ? 'on' : ''}`} onClick={() => setSeries('')}>كل السلاسل</button>{DJI_SERIES.map(s => <button key={s} className={`chip ${series === s ? 'on' : ''}`} onClick={() => setSeries(s)}>{s}</button>)}</div>
          <div className="chip-list">
            {DJI_DRONES.filter(d => !series || d.series === series).map(d => <button key={d.id} className={`chip ${compat.includes(d.id) ? 'on' : ''}`} onClick={() => u('compatible', compat.includes(d.id) ? compat.filter(x => x !== d.id) : [...compat, d.id])}>{d.name}</button>)}
          </div>
          {compat.length > 0 && <span className="hint">{compat.length} طراز محدد</span>}
        </div>
      )}
      {tab === 'media' && (
        <div className="stack">
          <Field label="صور المنتج"><ImageUploader images={p.images || []} onChange={imgs => u('images', imgs)} /></Field>
          <Field label="الرسم البديل (يظهر عندما لا توجد صور)"><IllustrationPicker value={(p.illustration || 'box') as IllustrationKey} onChange={k => u('illustration', k)} /></Field>
        </div>
      )}
    </Modal>
  )
}

function CategoriesEditor({ categories, onClose, onSaved }: { categories: Category[]; onClose: () => void; onSaved: (c: Category[]) => void }) {
  const { toast } = useStore()
  const [list, setList] = useState<Category[]>(categories)
  const [busy, setBusy] = useState(false)
  const u = (i: number, patch: Partial<Category>) => setList(l => l.map((c, k) => (k === i ? { ...c, ...patch } : c)))
  const move = (i: number, d: number) => setList(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n })
  const save = async () => {
    if (list.some(c => !c.name.trim())) return toast('كل قسم يحتاج اسماً', 'err')
    setBusy(true)
    try { onSaved(await api.admin.saveCategories(list)); toast('تم حفظ الأقسام') } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title="الأقسام" onClose={onClose} wide footer={<><button className="btn btn-ghost" onClick={onClose}>إلغاء</button><button className="btn btn-primary" disabled={busy} onClick={save}><Icon.Check />حفظ الأقسام</button></>}>
      <div className="list-editor">
        {list.map((c, i) => (
          <div key={c.id || i} className="item" style={{ gridTemplateColumns: 'auto 1fr 1fr auto', alignItems: 'center' }}>
            <span style={{ width: 36, height: 36 }}><Illustration name={c.icon} /></span>
            <div className="stack" style={{ gap: 6 }}><input className="input input-sm" placeholder="اسم القسم" value={c.name} onChange={e => u(i, { name: e.target.value })} /><input className="input input-sm" placeholder="وصف قصير" value={c.description || ''} onChange={e => u(i, { description: e.target.value })} /></div>
            <select className="select input-sm" value={c.icon} onChange={e => u(i, { icon: e.target.value as IllustrationKey })}>{ILLUSTRATION_KEYS.map(k => <option key={k} value={k}>{ILLUSTRATION_LABEL[k]}</option>)}</select>
            <div className="row"><button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, -1)}>↑</button><button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, 1)}>↓</button><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setList(l => l.filter((_, k) => k !== i))}><Icon.Trash /></button></div>
          </div>
        ))}
        <button className="btn btn-outline btn-sm" onClick={() => setList(l => [...l, { id: '', name: '', description: '', icon: 'box', sort: l.length }])}><Icon.Plus />قسم جديد</button>
        <span className="hint">حذف قسم لا يحذف منتجاته؛ أعد تصنيفها من تعديل المنتج.</span>
      </div>
    </Modal>
  )
}

export function ProductsPage() {
  const { search } = useRoute()
  const { settings, categories: siteCats, reload, toast } = useStore()
  const [list, setList] = useState<Product[] | null>(null)
  const [cats, setCats] = useState<Category[]>(siteCats)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [editing, setEditing] = useState<Partial<Product> | null>(search.get('new') ? blank() : null)
  const [del, setDel] = useState<Product | null>(null)
  const [catsOpen, setCatsOpen] = useState(false)
  const load = () => Promise.all([api.admin.products(), api.admin.categories()]).then(([p, c]) => { setList(p); setCats(c) }).catch(e => toast((e as Error).message, 'err'))
  useEffect(() => { load() }, [])
  const shown = useMemo(() => (list || []).filter(p => (!cat || p.category === cat) && (!q || (p.name + ' ' + p.brand + ' ' + (p.sku || '')).toLowerCase().includes(q.toLowerCase()))), [list, cat, q])
  const catName = (id: string) => cats.find(c => c.id === id)?.name || '—'
  const quick = async (p: Product, patch: Partial<Product>) => {
    try { const saved = await api.admin.saveProduct({ ...p, ...patch }); setList(l => l!.map(x => (x.id === saved.id ? saved : x))); reload() } catch (e) { toast((e as Error).message, 'err') }
  }
  return (
    <>
      <div className="admin-top"><div><h1>المنتجات</h1><p>{list?.length ?? 0} منتج · {cats.length} قسم</p></div><div className="row wrap"><button className="btn btn-ghost btn-sm" onClick={() => setCatsOpen(true)}><Icon.Tag />الأقسام</button><button className="btn btn-primary btn-sm" onClick={() => setEditing(blank())}><Icon.Plus />منتج جديد</button></div></div>
      <div className="toolbar">
        <div className="search-bar" style={{ display: 'block', maxWidth: 320 }}><Icon.Search /><input className="input input-sm" placeholder="بحث بالاسم أو SKU" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className="select input-sm" style={{ width: 'auto' }} value={cat} onChange={e => setCat(e.target.value)}><option value="">كل الأقسام</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      {!list ? <Spinner /> : shown.length === 0 ? <Empty icon={<Icon.Package />} title="لا منتجات" text={list.length ? 'لا نتائج للبحث.' : 'ابدأ بإضافة منتجك الأول.'} action={<button className="btn btn-primary" onClick={() => setEditing(blank())}><Icon.Plus />منتج جديد</button>} /> : (
        <div className="table-wrap"><table className="tbl"><thead><tr><th></th><th>المنتج</th><th>القسم</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th></th></tr></thead><tbody>
          {shown.map(p => (
            <tr key={p.id}>
              <td><div className="thumb"><ProductImage image={p.images[0]} illustration={p.illustration} /></div></td>
              <td><b style={{ fontWeight: 600 }}>{p.name}</b><div className="hint">{p.brand}{p.demo ? ' · تجريبي' : ''}{p.featured ? ' · مميّز' : ''}</div></td>
              <td className="small">{catName(p.category)}</td>
              <td className="num">{fmtMoney(p.price, settings)}{p.oldPrice ? <div className="hint" style={{ textDecoration: 'line-through' }}>{fmtMoney(p.oldPrice, settings)}</div> : null}</td>
              <td><input className="input input-sm num" type="number" min={0} style={{ width: 76 }} defaultValue={p.stock} onBlur={e => Number(e.target.value) !== p.stock && quick(p, { stock: Number(e.target.value) })} /></td>
              <td><button className={`badge ${p.active ? 'badge-accent' : ''}`} style={{ cursor: 'pointer' }} onClick={() => quick(p, { active: !p.active })}>{p.active ? 'ظاهر' : 'مخفي'}</button></td>
              <td><div className="actions"><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(p)} title="تعديل"><Icon.Edit /></button><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDel(p)} title="حذف"><Icon.Trash /></button></div></td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      {editing && <ProductEditor initial={editing} categories={cats} onClose={() => { setEditing(null); if (search.get('new')) navigate('/admin/products', { replace: true, scroll: false }) }} onSaved={p => { setList(l => { const i = (l || []).findIndex(x => x.id === p.id); return i >= 0 ? l!.map(x => (x.id === p.id ? p : x)) : [p, ...(l || [])] }); setEditing(null); reload() }} />}
      {catsOpen && <CategoriesEditor categories={cats} onClose={() => setCatsOpen(false)} onSaved={c => { setCats(c); setCatsOpen(false); reload() }} />}
      {del && <Confirm title="حذف المنتج" danger confirmLabel="حذف" text={<>حذف «{del.name}» نهائياً؟ الطلبات السابقة لا تتأثر.</>} onClose={() => setDel(null)} onConfirm={async () => { await api.admin.deleteProduct(del.id); setList(l => l!.filter(x => x.id !== del.id)); reload(); toast('تم الحذف') }} />}
    </>
  )
}
