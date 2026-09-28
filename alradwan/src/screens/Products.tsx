import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, FileSpreadsheet, Upload, Pencil, Tag, Download } from 'lucide-react'
import { put, putMany, remove, useCollection, useCanSeeCost, useSettings } from '../db/store'
import type { Base, Category, Product } from '../db/types'
import { matches, money } from '../lib/format'
import { Chips, Empty, SearchInput } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { ProductForm } from '../ui/forms'
import { useProductStock } from '../ui/pickers'
import { downloadProductsTemplate, exportSheet, readProductsFile, type ImportedProduct } from '../lib/excel'
import { pickFile } from '../lib/platform'
import { newId } from '../lib/id'

export function Products() {
  const products = useCollection('products')
  const categories = useCollection('categories')
  const stock = useProductStock()
  const seeCost = useCanSeeCost()
  const settings = useSettings()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [edit, setEdit] = useState<Product | null | 'new'>(null)
  const [cats, setCats] = useState(false)
  const [imp, setImp] = useState<ImportedProduct[] | null>(null)
  const toast = useToast()
  useEffect(() => { if (params.get('new')) { setEdit('new'); setParams({}) } }, [params])

  const list = useMemo(() => Array.from(products.values()).filter(p => (cat === 'all' || (cat === 'none' ? !p.categoryId : p.categoryId === cat)) && matches(q, p.name, p.code, p.barcode, p.brand, p.cars, p.location)).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [products, q, cat])
  const catList = useMemo(() => Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [categories])

  const exportExcel = () => exportSheet('المنتجات', list.map(p => ({ 'الكود': p.code, 'الاسم': p.name, 'التصنيف': p.categoryId ? categories.get(p.categoryId)?.name ?? '' : '', 'الماركة': p.brand ?? '', 'السيارات': p.cars ?? '', 'الوحدة': p.unit, ...(seeCost ? { 'سعر الشراء': p.cost } : {}), 'سعر البيع': p.price, 'سعر الجملة': p.wholesalePrice ?? 0, 'الكمية': p.kind === 'service' ? '' : stock.get(p.id) ?? 0, 'حد التنبيه': p.minStock, 'المكان': p.location ?? '', 'باركود': p.barcode ?? '', 'ملاحظات': p.notes ?? '' })), 'المنتجات')
  const importExcel = async () => {
    const f = await pickFile('.xlsx,.xls,.csv')
    if (!f) return
    try { const { rows } = await readProductsFile(f); if (!rows.length) { toast.error('لم أجد أي صف فيه اسم أو كود'); return } setImp(rows) } catch (e) { toast.error('تعذّر قراءة الملف: ' + (e as Error).message) }
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث بالاسم أو الكود أو السيارة أو الرف…" /></div>
        <button className="btn primary" onClick={() => setEdit('new')}><Plus /> قطعة جديدة</button>
        <button className="btn" onClick={() => setCats(true)} title="التصنيفات"><Tag /> <span className="hide-mobile">التصنيفات</span></button>
        <button className="btn" onClick={importExcel} title="استيراد من إكسل"><Upload /> <span className="hide-mobile">استيراد</span></button>
        <button className="btn" onClick={exportExcel} title="تصدير إلى إكسل"><FileSpreadsheet /> <span className="hide-mobile">إكسل</span></button>
      </div>
      <Chips value={cat} onChange={setCat} items={[{ id: 'all', label: `الكل (${products.size})` }, ...catList.map(c => ({ id: c.id, label: c.name })), { id: 'none', label: 'بدون تصنيف' }]} />
      <div className="card">
        {list.length === 0 ? <Empty title={products.size === 0 ? 'لا توجد قطع بعد' : 'لا نتائج'} text={products.size === 0 ? 'أضف قطعك واحدة واحدة، أو استوردها دفعة واحدة من ملف إكسل' : undefined} action={products.size === 0 ? <div className="btn-row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={() => setEdit('new')}><Plus /> قطعة جديدة</button><button className="btn" onClick={importExcel}><Upload /> استيراد من إكسل</button><button className="btn ghost" onClick={downloadProductsTemplate}><Download /> نموذج إكسل</button></div> : undefined} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th className="hide-mobile">الكود</th><th>الاسم</th><th className="hide-mobile">السيارات</th><th className="hide-mobile">المكان</th>{seeCost && <th className="num hide-mobile">الشراء</th>}<th className="num">البيع</th><th className="num">الكمية</th><th className="actions"></th></tr></thead>
            <tbody>{list.map(p => { const st = stock.get(p.id) ?? 0; return (
              <tr key={p.id} className="click" onClick={() => setEdit(p)}>
                <td className="mono small muted hide-mobile" style={{ whiteSpace: 'nowrap' }}>{p.code}</td>
                <td><div className="bold">{p.name}</div><div className="small muted"><span className="hide-desktop"><span className="mono">{p.code}</span>{' · '}</span>{[p.brand, p.categoryId ? categories.get(p.categoryId)?.name : ''].filter(Boolean).join(' · ')}</div></td>
                <td className="hide-mobile small">{p.cars}</td>
                <td className="hide-mobile small muted">{p.location}</td>
                {seeCost && <td className="num hide-mobile muted">{money(p.cost, { currency: false })}</td>}
                <td className="num bold">{money(p.price, { currency: false })}</td>
                <td className="num">{p.kind === 'service' ? <span className="badge tone-info">خدمة</span> : <span className={`badge ${st <= 0 ? 'tone-danger' : st <= p.minStock ? 'tone-warning' : 'tone-success'}`}>{st} {p.unit}</span>}</td>
                <td className="actions"><button className="btn sm ghost icon" onClick={e => { e.stopPropagation(); setEdit(p) }}><Pencil /></button></td>
              </tr>
            ) })}</tbody>
          </table></div>
        )}
      </div>
      <div className="muted small">{list.length} قطعة · العملة {settings.currency}</div>
      {edit && <ProductForm initial={edit === 'new' ? undefined : edit} currentStock={edit === 'new' ? 0 : stock.get(edit.id)} onClose={() => setEdit(null)} />}
      {cats && <CategoriesModal onClose={() => setCats(false)} />}
      {imp && <ImportModal rows={imp} onClose={() => setImp(null)} />}
    </div>
  )
}

function CategoriesModal({ onClose }: { onClose: () => void }) {
  const categories = useCollection('categories')
  const products = useCollection('products')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const confirm = useConfirm()
  const list = Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  const count = (id: string) => Array.from(products.values()).filter(p => p.categoryId === id).length
  const add = async () => { if (!name.trim()) return; if (editing) await put('categories', { ...editing, name: name.trim() }); else await put('categories', { name: name.trim() } as Category); setName(''); setEditing(null) }
  return (
    <Modal title="التصنيفات" onClose={onClose} size="narrow">
      <div className="row mb"><input className="input" placeholder={editing ? 'الاسم الجديد' : 'تصنيف جديد (فلاتر، فرامل، زيوت…)'} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} autoFocus /><button className="btn primary" onClick={add}>{editing ? 'حفظ' : 'إضافة'}</button></div>
      <div className="list">
        {list.map(c => (
          <div key={c.id} className="list-item"><div className="grow"><div className="title">{c.name}</div><div className="sub">{count(c.id)} قطعة</div></div>
            <button className="btn sm ghost" onClick={() => { setEditing(c); setName(c.name) }}>تعديل</button>
            <button className="btn sm ghost" style={{ color: 'var(--danger)' }} onClick={async () => { if (await confirm({ title: `حذف تصنيف «${c.name}»؟`, text: 'تبقى القطع، وتصبح بدون تصنيف.', danger: true, okText: 'حذف' })) await remove('categories', c.id) }}>حذف</button></div>
        ))}
        {list.length === 0 && <div className="muted" style={{ padding: 10 }}>لا تصنيفات بعد</div>}
      </div>
    </Modal>
  )
}

function ImportModal({ rows, onClose }: { rows: ImportedProduct[]; onClose: () => void }) {
  const products = useCollection('products')
  const categories = useCollection('categories')
  const settings = useSettings()
  const [mode, setMode] = useState<'update' | 'skip'>('update')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const byCode = new Map(Array.from(products.values()).map(p => [p.code.toLowerCase(), p]))
  const existing = rows.filter(r => r.code && byCode.has(r.code.toLowerCase())).length
  const run = async () => {
    setBusy(true)
    try {
      const entries: { collection: 'products' | 'categories' | 'movements'; record: Base }[] = []
      const catByName = new Map(Array.from(categories.values()).map(c => [c.name.trim(), c]))
      let added = 0, updated = 0, n = 0
      for (const r of rows) {
        let categoryId: string | undefined
        if (r.category) {
          let c = catByName.get(r.category.trim())
          if (!c) { c = { id: newId(), updatedAt: 0, name: r.category.trim() }; catByName.set(c.name, c); entries.push({ collection: 'categories', record: c }) }
          categoryId = c.id
        }
        const code = r.code || `P-${String(products.size + ++n).padStart(4, '0')}`
        const old = byCode.get(code.toLowerCase())
        if (old) {
          if (mode === 'skip') continue
          const rec: Product = { ...old, name: r.name || old.name, barcode: r.barcode ?? old.barcode, categoryId: categoryId ?? old.categoryId, brand: r.brand ?? old.brand, cars: r.cars ?? old.cars, unit: r.unit || old.unit, cost: r.cost || old.cost, price: r.price || old.price, wholesalePrice: r.wholesalePrice ?? old.wholesalePrice, minStock: r.minStock ?? old.minStock, location: r.location ?? old.location, notes: r.notes ?? old.notes }
          entries.push({ collection: 'products', record: rec }); updated++
        } else {
          const rec: Product = { id: newId(), updatedAt: 0, code, name: r.name, barcode: r.barcode, categoryId, brand: r.brand, cars: r.cars, unit: r.unit || settings.units[0] || 'قطعة', cost: r.cost, price: r.price, wholesalePrice: r.wholesalePrice, minStock: r.minStock ?? settings.lowStockDefault, openingStock: r.stock ?? 0, location: r.location, notes: r.notes, kind: 'product', createdAt: Date.now() }
          byCode.set(code.toLowerCase(), rec)
          entries.push({ collection: 'products', record: rec }); added++
        }
      }
      await putMany(entries)
      toast.success(`تم الاستيراد: ${added} جديدة، ${updated} محدَّثة`)
      onClose()
    } catch (e) { toast.error('فشل الاستيراد: ' + (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title="استيراد المنتجات من إكسل" onClose={onClose} size="wide" footer={<><button className="btn primary" onClick={run} disabled={busy}><Upload /> استيراد {rows.length} صف</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <p className="mb">وجدت <b>{rows.length}</b> قطعة في الملف، منها <b>{existing}</b> موجودة سابقاً بنفس الكود.</p>
      {existing > 0 && <div className="tabs small mb"><button className={mode === 'update' ? 'active' : ''} onClick={() => setMode('update')}>تحديث الموجودة (الأسعار والبيانات)</button><button className={mode === 'skip' ? 'active' : ''} onClick={() => setMode('skip')}>تجاهل الموجودة</button></div>}
      <p className="help mb">ملاحظة: عمود «الكمية» يُستخدم للقطع الجديدة فقط كرصيد أول. كميات القطع الموجودة تُعدَّل من شاشة المخزون.</p>
      <div className="table-wrap" style={{ maxHeight: 300 }}><table className="table">
        <thead><tr><th>الكود</th><th>الاسم</th><th>التصنيف</th><th className="num">الشراء</th><th className="num">البيع</th><th className="num">الكمية</th></tr></thead>
        <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}><td className="mono small">{r.code}</td><td>{r.name}</td><td>{r.category}</td><td className="num">{r.cost}</td><td className="num">{r.price}</td><td className="num">{r.stock ?? ''}</td></tr>)}</tbody>
      </table>{rows.length > 50 && <div className="muted small" style={{ padding: 8 }}>… و{rows.length - 50} صفاً آخر</div>}</div>
    </Modal>
  )
}
