import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, FileSpreadsheet, Upload, Pencil, Tag, Download, Barcode, Printer, Zap } from 'lucide-react'
import { printDocument } from '../print/PrintHost'
import { can, put, putMany, remove, useCollection, useCanSeeCost, useSettings, usePerm } from '../db/store'
import type { Base, Category, CurrencyCode, Product } from '../db/types'
import { convert, CURRENCY_DECIMALS, CURRENCY_SYMBOL, matches, money, norm, otherCurrency } from '../lib/format'
import { NumberInput } from '../ui/components'
import { Chips, Empty, SearchInput } from '../ui/components'
import { Modal, dialogDepth, useConfirm } from '../ui/modal'
import { SCAN_PRIORITY, useScan } from '../lib/scan'
import { findProductByScan, notAProductCode, prefillFromScan } from '../lib/productMatch'
import { ScanButton } from '../ui/scanFlow'
import { IntakePanel } from '../ui/intake'
import { useToast } from '../ui/toast'
import { ProductForm } from '../ui/forms'
import { useProductStock } from '../ui/pickers'
import { amountsLookLike, downloadProductsTemplate, exportSheet, readProductsFile, type ImportedProduct } from '../lib/excel'
import { pickFile } from '../lib/platform'
import { newId } from '../lib/id'

export function Products() {
  const products = useCollection('products')
  const categories = useCollection('categories')
  const stock = useProductStock()
  const seeCost = useCanSeeCost()
  const canAdd = usePerm('products')
  const settings = useSettings()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [edit, setEdit] = useState<Product | null | 'new'>(null)
  const [scanned, setScanned] = useState<{ initial?: Partial<Product>; scan: string } | null>(null)
  const [intake, setIntake] = useState(false)
  const [cats, setCats] = useState(false)
  const [imp, setImp] = useState<{ rows: ImportedProduct[]; guessed?: string } | null>(null)
  const [labels, setLabels] = useState(false)
  const [limit, setLimit] = useState(150)
  const toast = useToast()
  useEffect(() => { if (params.get('new')) { setEdit('new'); setParams({}) } }, [params])
  // scanning here opens the part, or a new part with the barcode already filled in
  useScan(s => {
    if (dialogDepth() > 0) return false
    const hit = findProductByScan(products.values(), s.text)
    if (hit) { setEdit(hit.product); setScanned({ scan: s.text }); return true }
    const why = notAProductCode(s.text)
    if (why) { toast.error(why); return 'reject' }
    if (!canAdd) { toast.error(`الرمز ${s.text} غير مسجّل لأي قطعة`); return 'reject' }
    setEdit('new'); setScanned({ initial: prefillFromScan(s.text), scan: s.text })
    return true
  }, { priority: SCAN_PRIORITY.screen, enabled: !intake })

  const list = useMemo(() => Array.from(products.values()).filter(p => (cat === 'all' || (cat === 'none' ? !p.categoryId : cat === 'noprice' ? !(p.price > 0) : p.categoryId === cat)) && matches(q, p.name, p.code, p.barcode, p.brand, p.cars, p.location, p.oemNumbers)).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [products, q, cat])
  const noPrice = useMemo(() => Array.from(products.values()).filter(p => !(p.price > 0)).length, [products])
  const catList = useMemo(() => Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [categories])

  const exportExcel = () => exportSheet('المنتجات', list.map(p => ({ 'الكود': p.code, 'الاسم': p.name, 'التصنيف': p.categoryId ? categories.get(p.categoryId)?.name ?? '' : '', 'الماركة': p.brand ?? '', 'السيارات': p.cars ?? '', 'الوحدة': p.unit, ...(seeCost ? { 'سعر الشراء': p.cost } : {}), 'سعر البيع': p.price, 'سعر الجملة': p.wholesalePrice ?? 0, 'الكمية': p.kind === 'service' ? '' : stock.get(p.id) ?? 0, 'حد التنبيه': p.minStock, 'المكان': p.location ?? '', 'باركود': p.barcode ?? '', 'OEM': p.oemNumbers ?? '', 'ملاحظات': p.notes ?? '' })), 'المنتجات')
  const importExcel = async () => {
    const f = await pickFile('.xlsx,.xls,.csv')
    if (!f) return
    try { const { rows, guessed } = await readProductsFile(f); if (!rows.length) { toast.error('لم أجد في الملف أي صف فيه اسم قطعة أو كود'); return } setImp({ rows, guessed }) } catch (e) { toast.error('تعذّر قراءة الملف: ' + (e as Error).message) }
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث بالاسم أو الكود أو السيارة أو الرف…" /></div>
        {canAdd && <button className="btn primary" onClick={() => setEdit('new')}><Plus /> قطعة جديدة</button>}
        <ScanButton className="btn" label="مسح باركود" />
        {canAdd && !intake && <button className="btn" onClick={() => setIntake(true)} title="امسح العلب واحدة تلو الأخرى فتُضاف القطع وحدها بأسمائها"><Zap /> <span className="hide-mobile">إدخال سريع بالمسح</span></button>}
        {canAdd && <button className="btn" onClick={() => setCats(true)} title="التصنيفات"><Tag /> <span className="hide-mobile">التصنيفات</span></button>}
        {canAdd && <button className="btn" onClick={importExcel} title="استيراد من إكسل"><Upload /> <span className="hide-mobile">استيراد</span></button>}
        <button className="btn" onClick={exportExcel} title="تصدير إلى إكسل"><FileSpreadsheet /> <span className="hide-mobile">إكسل</span></button>
        <button className="btn" onClick={() => setLabels(true)} title="طباعة ملصقات باركود"><Barcode /> <span className="hide-mobile">ملصقات</span></button>
      </div>
      {intake && <IntakePanel onClose={() => setIntake(false)} onEdit={p => setEdit(p)} />}
      <Chips value={cat} onChange={setCat} items={[{ id: 'all', label: `الكل (${products.size})` }, ...catList.map(c => ({ id: c.id, label: c.name })), { id: 'none', label: 'بدون تصنيف' }, ...(noPrice ? [{ id: 'noprice', label: `بلا سعر (${noPrice})` }] : [])]} />
      <div className="card">
        {list.length === 0 ? <Empty title={products.size === 0 ? 'لا توجد قطع بعد' : 'لا نتائج'} text={products.size === 0 ? 'أضف قطعك واحدة واحدة، أو استوردها دفعة واحدة من ملف إكسل' : undefined} action={products.size === 0 ? <div className="btn-row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={() => setEdit('new')}><Plus /> قطعة جديدة</button><button className="btn" onClick={importExcel}><Upload /> استيراد من إكسل</button><button className="btn ghost" onClick={downloadProductsTemplate}><Download /> نموذج إكسل</button></div> : undefined} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th className="hide-mobile">الكود</th><th>الاسم</th><th className="hide-mobile">السيارات</th><th className="hide-mobile">المكان</th>{seeCost && <th className="num hide-mobile">الشراء</th>}<th className="num">البيع</th><th className="num">الكمية</th><th className="actions"></th></tr></thead>
            <tbody>{list.slice(0, limit).map(p => { const st = stock.get(p.id) ?? 0; return (
              <tr key={p.id} className="click" onClick={() => setEdit(p)}>
                <td className="mono small muted hide-mobile" style={{ whiteSpace: 'nowrap' }}>{p.code}</td>
                <td><div className="bold">{p.name}</div><div className="small muted"><span className="hide-desktop"><span className="mono">{p.code}</span>{' · '}</span>{[p.brand, p.categoryId ? categories.get(p.categoryId)?.name : ''].filter(Boolean).join(' · ')}</div></td>
                <td className="hide-mobile small">{p.cars}</td>
                <td className="hide-mobile small muted">{p.location}</td>
                {seeCost && <td className="num hide-mobile muted">{money(p.cost, { currency: false })}</td>}
                <td className="num bold">{money(p.price, { currency: false })}</td>
                <td className="num">{p.kind === 'service' ? <span className="badge tone-info">خدمة</span> : <span className={`badge ${st <= 0 ? 'tone-danger' : st <= p.minStock ? 'tone-warning' : 'tone-success'}`}><span className="mono">{st}</span> {p.unit}</span>}</td>
                <td className="actions"><button className="btn sm ghost icon" onClick={e => { e.stopPropagation(); setEdit(p) }}><Pencil /></button></td>
              </tr>
            ) })}</tbody>
          </table></div>
        )}
        {list.length > limit && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn" onClick={() => setLimit(l => l + 300)}>عرض المزيد ({list.length - limit} متبقٍ)</button></div>}
      </div>
      <div className="muted small">{list.length} قطعة · العملة {settings.currency}</div>
      {edit && <ProductForm initial={edit === 'new' ? scanned?.initial : edit} scanned={scanned?.scan} currentStock={edit === 'new' ? 0 : stock.get(edit.id)} onClose={() => { setEdit(null); setScanned(null) }} />}
      {cats && <CategoriesModal onClose={() => setCats(false)} />}
      {imp && <ImportModal rows={imp.rows} guessed={imp.guessed} onClose={() => setImp(null)} />}
      {labels && <LabelsModal products={list.filter(p => p.kind === 'product')} onClose={() => setLabels(false)} />}
    </div>
  )
}

/** Shelf labels with a barcode: pick which parts and how many copies, then print on label sheets or a label printer. */
function LabelsModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const [copies, setCopies] = useState<Record<string, number>>({})
  const [size, setSize] = useState<'small' | 'medium'>('medium')
  const [showPrice, setShowPrice] = useState(true)
  const [q, setQ] = useState('')
  const chosen = products.filter(p => (copies[p.id] ?? 0) > 0)
  const shown = products.filter(p => matches(q, p.name, p.code, p.barcode)).slice(0, 200)
  const print = () => { if (chosen.length === 0) return; printDocument({ type: 'labels', products: chosen.map(p => ({ product: p, copies: copies[p.id] })), size, showPrice }); onClose() }
  return (
    <Modal title="ملصقات الباركود" onClose={onClose} size="wide" footer={<><button className="btn primary" onClick={print} disabled={chosen.length === 0}><Printer /> طباعة {chosen.reduce((n, p) => n + copies[p.id], 0) || ''} ملصق</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="tabs small" style={{ flex: 1, minWidth: 220 }}><button className={size === 'medium' ? 'active' : ''} onClick={() => setSize('medium')}>50×30 مم</button><button className={size === 'small' ? 'active' : ''} onClick={() => setSize('small')}>38×21 مم</button></div>
          <label className="checkbox"><input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} /> مع السعر</label>
          <button className="btn sm" onClick={() => setCopies(Object.fromEntries(shown.map(p => [p.id, 1])))}>واحد لكل قطعة معروضة</button>
          <button className="btn sm ghost" onClick={() => setCopies({})}>مسح</button>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="ابحث عن القطعة…" />
        <div className="table-wrap" style={{ maxHeight: 340 }}><table className="table"><thead><tr><th>القطعة</th><th>الباركود / الكود</th><th className="num">عدد الملصقات</th></tr></thead>
          <tbody>{shown.map(p => <tr key={p.id}><td><div className="bold">{p.name}</div></td><td className="mono small">{p.barcode || p.code}</td><td className="num" style={{ width: 120 }}><NumberInput value={copies[p.id] ?? 0} onChange={v => setCopies(c => ({ ...c, [p.id]: Math.max(0, Math.round(v)) }))} min={0} /></td></tr>)}</tbody></table></div>
        <p className="help">يُطبع باركود Code 128 من حقل «الباركود» إن وُجد وإلا من الكود. للطابعات الحرارية اختر حجم الورق المناسب من نافذة الطباعة.</p>
      </div>
    </Modal>
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

function ImportModal({ rows, guessed, onClose }: { rows: ImportedProduct[]; guessed?: string; onClose: () => void }) {
  const products = useCollection('products')
  const categories = useCollection('categories')
  const settings = useSettings()
  const [mode, setMode] = useState<'update' | 'skip'>('update')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const base = settings.baseCurrency ?? 'SYP'
  const other = otherCurrency(base)
  // the currency the file's prices are in: prices like 0.16 and 2.5 in a pound shop are dollars
  const [cur, setCur] = useState<CurrencyCode>(() => (amountsLookLike(rows.flatMap(r => [r.cost, r.price]), other) ? other : base))
  const d = 10 ** CURRENCY_DECIMALS[base]
  const toBase = (n: number) => (n ? Math.round(convert(n, cur, base, settings.rate) * d) / d : n)
  const byCode = new Map(Array.from(products.values()).map(p => [p.code.toLowerCase(), p]))
  // a row without a code is the part of the same name (a list from another program, imported again)
  const byName = new Map(Array.from(products.values()).map(p => [norm(p.name), p]))
  const match = (r: ImportedProduct) => (r.code ? byCode.get(r.code.toLowerCase()) : byName.get(norm(r.name)))
  const existing = rows.filter(r => match(r)).length
  const run = async () => {
    if (!can('products')) { toast.error('ليس لديك صلاحية إضافة القطع'); return }
    if (cur !== base && !(settings.rate > 0)) { toast.error('أدخل سعر الدولار أولاً (من الزر أعلى الشاشة)'); return }
    const prices = can('editPrices')
    setBusy(true)
    try {
      const entries: { collection: 'products' | 'categories' | 'movements'; record: Base }[] = []
      const catByName = new Map(Array.from(categories.values()).map(c => [c.name.trim(), c]))
      let added = 0, updated = 0, n = 0
      for (const raw of rows) {
        const r = cur === base ? raw : { ...raw, cost: toBase(raw.cost), price: toBase(raw.price), wholesalePrice: raw.wholesalePrice === undefined ? undefined : toBase(raw.wholesalePrice) }
        let categoryId: string | undefined
        if (r.category) {
          let c = catByName.get(r.category.trim())
          if (!c) { c = { id: newId(), updatedAt: 0, name: r.category.trim() }; catByName.set(c.name, c); entries.push({ collection: 'categories', record: c }) }
          categoryId = c.id
        }
        const old = match(r)
        // a new part without a code gets the next free one
        let code = r.code || old?.code || ''
        while (!code || (!old && !r.code && byCode.has(code.toLowerCase()))) code = `P-${String(products.size + ++n).padStart(4, '0')}`
        if (old) {
          if (mode === 'skip') continue
          const rec: Product = { ...old, name: r.name || old.name, barcode: r.barcode ?? old.barcode, oemNumbers: r.oemNumbers ?? old.oemNumbers, categoryId: categoryId ?? old.categoryId, brand: r.brand ?? old.brand, cars: r.cars ?? old.cars, unit: r.unit || old.unit, cost: prices ? r.cost || old.cost : old.cost, price: prices ? r.price || old.price : old.price, wholesalePrice: prices ? r.wholesalePrice ?? old.wholesalePrice : old.wholesalePrice, minStock: r.minStock ?? old.minStock, location: r.location ?? old.location, notes: r.notes ?? old.notes }
          entries.push({ collection: 'products', record: rec }); updated++
        } else {
          const rec: Product = { id: newId(), updatedAt: 0, code, name: r.name, barcode: r.barcode, oemNumbers: r.oemNumbers, categoryId, brand: r.brand, cars: r.cars, unit: r.unit || settings.units[0] || 'قطعة', cost: r.cost, price: r.price, wholesalePrice: r.wholesalePrice, minStock: r.minStock ?? settings.lowStockDefault, openingStock: r.stock ?? 0, location: r.location, notes: r.notes, kind: 'product', createdAt: Date.now() }
          byCode.set(code.toLowerCase(), rec); byName.set(norm(rec.name), rec)
          entries.push({ collection: 'products', record: rec }); added++
        }
      }
      await putMany(entries)
      toast.success(`تم الاستيراد: ${added} جديدة، ${updated} محدَّثة`)
      onClose()
    } catch (e) { toast.error('فشل الاستيراد: ' + (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title="استيراد المنتجات من إكسل" onClose={onClose} size="wide" footer={<><button className="btn primary" onClick={run} disabled={busy || (cur !== base && !(settings.rate > 0))}><Upload /> استيراد {rows.length} صف</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      {guessed && <div className="card pad tone-warning mb" style={{ padding: '10px 14px' }}>{guessed}</div>}
      <p className="mb">وجدت <b>{rows.length}</b> قطعة في الملف، منها <b>{existing}</b> موجودة سابقاً (بنفس الكود، أو بنفس الاسم إن لم يكن لها كود).</p>
      {existing > 0 && <div className="tabs small mb"><button className={mode === 'update' ? 'active' : ''} onClick={() => setMode('update')}>تحديث الموجودة (الأسعار والبيانات)</button><button className={mode === 'skip' ? 'active' : ''} onClick={() => setMode('skip')}>تجاهل الموجودة</button></div>}
      <div className="row mb" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>الأسعار في الملف بـ</span>
        <div className="tabs small">{[base, other].map(c => <button key={c} className={cur === c ? 'active' : ''} onClick={() => setCur(c)}>{CURRENCY_SYMBOL[c]}</button>)}</div>
        {cur !== base && (settings.rate > 0 ? <span className="muted small">تُحوَّل إلى {CURRENCY_SYMBOL[base]} بسعر <span dir="ltr">1 $ = {settings.rate.toLocaleString('en-US')} ل.س</span></span> : <span className="small" style={{ color: 'var(--danger)' }}>أدخل سعر الدولار أولاً</span>)}
      </div>
      <p className="help mb">ملاحظة: عمود «الكمية» يُستخدم للقطع الجديدة فقط كرصيد أول. كميات القطع الموجودة تُعدَّل من شاشة المخزون.</p>
      <div className="table-wrap" style={{ maxHeight: 300 }}><table className="table">
        <thead><tr><th>الكود</th><th>الاسم</th><th>التصنيف</th><th className="num">الشراء</th><th className="num">البيع</th><th className="num">الكمية</th></tr></thead>
        <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}><td className="mono small">{r.code}</td><td>{r.name}</td><td>{r.category}</td><td className="num">{money(toBase(r.cost), { currency: false })}</td><td className="num">{money(toBase(r.price), { currency: false })}</td><td className="num">{r.stock ?? ''}</td></tr>)}</tbody>
      </table>{rows.length > 50 && <div className="muted small" style={{ padding: 8 }}>… و{rows.length - 50} صفاً آخر</div>}</div>
    </Modal>
  )
}
