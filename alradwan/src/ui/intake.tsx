import { useRef, useState } from 'react'
import { ScanLine, Camera, Pencil, Globe, Check, RefreshCw } from 'lucide-react'
import { audit, put, usePerm, useSettings, useStore } from '../db/store'
import type { Product } from '../db/types'
import { SCAN_PRIORITY, useScan } from '../lib/scan'
import { barcodeToSave, findProductByScan } from '../lib/productMatch'
import { brandHint, codeFacts, learnBrandPrefixes, publicGtin } from '../lib/gs1'
import { lookupEnabled, lookupProduct, shareCatalogChanges, SOURCE_LABEL, type LookupSource } from '../lib/productLookup'
import { norm, toNumber } from '../lib/format'
import { dialogDepth } from './modal'
import { CameraScanner } from './scanner'
import { nextCode } from './forms'
import { useToast } from './toast'

interface Row { key: string; code: string; productId?: string; status: 'looking' | 'new' | 'existing'; count: number; source?: LookupSource | null }

/** Fast intake: every box scanned becomes a part at once, named from the shared catalogue or the internet,
 *  and every further scan of the same box counts one more. Prices can be typed here or later. */
export function IntakePanel({ onClose, onEdit }: { onClose: () => void; onEdit: (p: Product) => void }) {
  const products = useStore(s => s.products) as unknown as Map<string, Product>
  const settings = useSettings()
  const canAdd = usePerm('products')
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [camera, setCamera] = useState(false)
  // barcode → the part made from it in this session, and the scans that arrived while it was being looked up
  const made = useRef(new Map<string, string>())
  const waiting = useRef(new Map<string, number>())
  // parts are created one after another, so two new parts never get the same code
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const later = (job: () => Promise<void>) => { queue.current = queue.current.then(job).catch(e => toast.error('تعذّر الحفظ: ' + (e as Error).message)) }
  const keyOf = (text: string) => publicGtin(text) ?? norm(barcodeToSave(text))
  const upsertRow = (key: string, patch: Partial<Row> & { code: string }) => setRows(l => {
    const i = l.findIndex(r => r.key === key)
    if (i < 0) return [{ key, status: 'looking', count: 0, ...patch }, ...l]
    const copy = l.filter((_, k) => k !== i)
    return [{ ...l[i], ...patch }, ...copy]
  })

  const take = (text: string): boolean | 'reject' => {
    const key = keyOf(text)
    const code = barcodeToSave(text)
    // still being looked up: one more box of it
    if (waiting.current.has(key)) { waiting.current.set(key, waiting.current.get(key)! + 1); upsertRow(key, { code, count: waiting.current.get(key)! }); return true }
    const st = useStore.getState().products as unknown as Map<string, Product>
    const madeId = made.current.get(key)
    const hit = madeId ? st.get(madeId) : findProductByScan(st.values(), text)?.product
    if (hit && madeId) {
      // made in this session: each scan is one more in stock
      later(async () => {
        const p = (useStore.getState().products as unknown as Map<string, Product>).get(hit.id)
        if (!p) return
        await put('products', { ...p, openingStock: (p.openingStock || 0) + 1 })
        upsertRow(key, { code, count: (p.openingStock || 0) + 1 })
      })
      return true
    }
    if (hit) { upsertRow(key, { code, productId: hit.id, status: 'existing', count: 0 }); return true }
    if (!canAdd) { toast.error('ليس لديك صلاحية إضافة القطع'); return 'reject' }
    waiting.current.set(key, 1)
    upsertRow(key, { code, status: 'looking', count: 1 })
    void (async () => {
      const found = lookupEnabled() ? await lookupProduct(text).catch(() => null) : null
      later(async () => {
        const count = waiting.current.get(key) ?? 1
        const now = Date.now()
        // not found anywhere: the maker (and part number) its barcode gives away still names it
        const hint = found ? null : brandHint(text, learnBrandPrefixes((useStore.getState().products as unknown as Map<string, Product>).values()))
        const named = found?.name || (hint?.partNumber ? `${hint.brand} ${hint.partNumber}` : `قطعة ${code}`)
        const p = await put('products', {
          code: nextCode(useStore.getState().products as unknown as Map<string, Product>), barcode: code, name: named, brand: found?.brand ?? hint?.brand ?? '', cars: '',
          oemNumbers: codeFacts(text).looksLikePartNumber ? text.trim() : hint?.partNumber, image: found?.image,
          unit: settings.units[0] ?? 'قطعة', cost: 0, price: 0, wholesalePrice: 0, minStock: settings.lowStockDefault, openingStock: count, openingCost: 0,
          location: '', notes: '', kind: 'product', createdAt: now,
        } as Omit<Product, 'id' | 'updatedAt'>)
        await audit('create', `إضافة قطعة بالمسح السريع ${p.name} (${p.code}) — الكمية ${count}`, 'products', p.id)
        // boxes of it scanned while it was being saved count too
        const total = waiting.current.get(key) ?? count
        made.current.set(key, p.id)
        waiting.current.delete(key)
        if (total !== count) await put('products', { ...p, openingStock: total })
        upsertRow(key, { code, productId: p.id, status: 'new', count: total, source: found?.source ?? null })
        if (found) void shareCatalogChanges()
      })
    })()
    return true
  }
  useScan(s => (dialogDepth() > 0 ? false : take(s.text)), { priority: SCAN_PRIORITY.screen })

  const added = rows.filter(r => r.status === 'new')
  const boxes = added.reduce((n, r) => n + r.count, 0)
  return (
    <div className="card pad intake">
      <div className="card-title">
        <h2><ScanLine size={18} style={{ verticalAlign: -3 }} /> الإدخال السريع بالمسح</h2>
        <div className="row">
          <button className="btn sm" onClick={() => setCamera(true)}><Camera /> الكاميرا</button>
          <button className="btn sm primary" onClick={onClose}><Check /> إنهاء</button>
        </div>
      </div>
      <p className="help">امسح باركود كل علبة بالقارئ أو بالكاميرا: تُضاف القطعة فوراً باسمها وصورتها {lookupEnabled() ? 'من قاعدة الباركود أو الإنترنت' : ''} دون كتابة، وكل مسح آخر لنفس القطعة يزيد كميتها. اكتب الأسعار هنا أو لاحقاً من فلتر «بلا سعر».</p>
      {rows.length > 0 && <div className="small muted mb">أُضيفت {added.length} قطعة · {boxes} علبة</div>}
      {rows.length === 0 ? <div className="scan-test empty">بانتظار أول مسح…</div> : (
        <div className="list">
          {rows.map(r => <IntakeRow key={r.key} row={r} product={r.productId ? products.get(r.productId) : undefined} onEdit={onEdit} />)}
        </div>
      )}
      {camera && <CameraScanner onClose={() => setCamera(false)} hint="امسح العلب واحدة تلو الأخرى؛ تبقى الكاميرا مفتوحة. أغلقها عند الانتهاء." onCode={d => { take(d.text); return true }} />}
    </div>
  )
}

function IntakeRow({ row, product: p, onEdit }: { row: Row; product?: Product; onEdit: (p: Product) => void }) {
  const placeholder = !!p && /^قطعة\s+\S+$/.test(p.name)
  return (
    <div className="list-item intake-row">
      {p?.image ? <img src={p.image} alt="" /> : <span className="intake-img" />}
      <div className="grow" style={{ minWidth: 0 }}>
        {row.status === 'looking' && <div className="title"><RefreshCw size={14} className="spin" style={{ verticalAlign: -2 }} /> جارٍ البحث عن اسمها…</div>}
        {p && (placeholder ? <NameCell product={p} /> : <div className="title">{p.name}</div>)}
        <div className="sub"><span className="mono" dir="ltr">{row.code}</span>
          {row.status === 'existing' && ' · موجودة مسبقاً (لم تتغير كميتها)'}
          {row.status === 'new' && (row.source ? <> · <Globe size={12} style={{ verticalAlign: -2 }} /> {SOURCE_LABEL[row.source]}</> : ' · لم يُعثر على اسمها — اكتبه')}
        </div>
      </div>
      {row.status !== 'existing' && <span className="badge tone-info" title="الكمية"><span className="mono">{row.count}</span></span>}
      {p && row.status === 'new' && <PriceCell product={p} />}
      {p && <button className="btn sm ghost icon" title="تعديل" aria-label="تعديل" onClick={() => onEdit(p)}><Pencil /></button>}
    </div>
  )
}

/** The name, typed where it could not be found. */
function NameCell({ product: p }: { product: Product }) {
  const [v, setV] = useState('')
  const save = async () => { const name = v.trim(); if (name.length < 2) return; await put('products', { ...p, name }); void shareCatalogChanges() }
  return <input className="input sm" placeholder="اكتب اسم القطعة" value={v} onChange={e => setV(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
}

/** The selling price, saved when the box loses the cursor. */
function PriceCell({ product: p }: { product: Product }) {
  const [v, setV] = useState(p.price ? String(p.price) : '')
  const save = async () => { const price = Math.max(0, toNumber(v)); if (price !== p.price) await put('products', { ...p, price }) }
  return <input className="input sm intake-price" inputMode="decimal" dir="ltr" placeholder="السعر" value={v} onChange={e => setV(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} aria-label="سعر البيع" />
}

