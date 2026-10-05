import { useEffect, useRef, useState } from 'react'
import { ScanLine, Camera, Pencil, Globe, Check, RefreshCw } from 'lucide-react'
import { audit, put, usePerm, useSettings, useStore } from '../db/store'
import type { Product } from '../db/types'
import { SCAN_PRIORITY, useScan } from '../lib/scan'
import { barcodeToSave, findProductByScan } from '../lib/productMatch'
import { brandHint, codeFacts, publicGtin } from '../lib/gs1'
import { lookupEnabled, lookupProduct, readBoxPhoto, shareCatalogChanges, SOURCE_LABEL, type LookupSource } from '../lib/productLookup'
import { API_URL } from '../lib/platform'
import { shrinkImage } from '../lib/image'
import { norm, toNumber } from '../lib/format'
import { dialogDepth } from './modal'
import { CameraScanner } from './scanner'
import { nextCode } from './forms'
import { useToast } from './toast'

interface Row { key: string; code: string; productId?: string; status: 'looking' | 'new' | 'existing'; count: number; source?: LookupSource | null }

// Shared by every intake panel: a part still being looked up when the panel is closed and opened again (or the
// screen left and reopened) is not created twice, and parts are created one after another, so two never get
// the same code. `made`: barcode → the part made from it, and which intake session made it.
const waiting = new Map<string, number>()
const made = new Map<string, { id: string; session: number }>()
let queue: Promise<unknown> = Promise.resolve()
let sessions = 0
const latest = (id: string) => (useStore.getState().products as unknown as Map<string, Product>).get(id)

/** Fast intake: every box scanned becomes a part at once, named from the shared catalogue or the internet,
 *  and every further scan of the same box counts one more. Prices can be typed here or later. */
export function IntakePanel({ onClose, onEdit }: { onClose: () => void; onEdit: (p: Product) => void }) {
  const products = useStore(s => s.products) as unknown as Map<string, Product>
  const settings = useSettings()
  const canAdd = usePerm('products')
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [camera, setCamera] = useState(false)
  const session = useRef(0)
  useEffect(() => { session.current = ++sessions }, [])
  // every write goes through one queue: creations, counts, and the price/name typed in a row
  const later = (job: () => Promise<void>) => { queue = queue.then(job).catch(e => toast.error('تعذّر الحفظ: ' + (e as Error).message)) }
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
    if (waiting.has(key)) { waiting.set(key, waiting.get(key)! + 1); upsertRow(key, { code, count: waiting.get(key)! }); return true }
    const st = useStore.getState().products as unknown as Map<string, Product>
    const m = made.get(key)
    const madeId = m && m.session === session.current ? m.id : undefined
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
    waiting.set(key, 1)
    const mine = session.current
    upsertRow(key, { code, status: 'looking', count: 1 })
    void (async () => {
      const found = lookupEnabled() ? await lookupProduct(text).catch(() => null) : null
      later(async () => {
        const count = waiting.get(key) ?? 1
        const now = Date.now()
        // not found anywhere: the maker (and part number) its barcode gives away still names it (only the
        // built-in makers here: nobody reviews these names before they are saved)
        const hint = found ? null : brandHint(text)
        const named = found?.name || (hint?.partNumber ? `${hint.brand} ${hint.partNumber}` : `قطعة ${code}`)
        const p = await put('products', {
          code: nextCode(useStore.getState().products as unknown as Map<string, Product>), barcode: code, name: named, catalogName: found?.name, brand: found?.brand ?? hint?.brand ?? '', cars: '',
          oemNumbers: codeFacts(text).looksLikePartNumber ? text.trim() : hint?.partNumber, image: found?.image,
          unit: settings.units[0] ?? 'قطعة', cost: 0, price: 0, wholesalePrice: 0, minStock: settings.lowStockDefault, openingStock: count, openingCost: 0,
          location: '', notes: '', kind: 'product', createdAt: now,
        } as Omit<Product, 'id' | 'updatedAt'>)
        await audit('create', `إضافة قطعة بالمسح السريع ${p.name} (${p.code}) — الكمية ${count}`, 'products', p.id)
        // boxes of it scanned while it was being saved count too
        const total = waiting.get(key) ?? count
        made.set(key, { id: p.id, session: mine })
        waiting.delete(key)
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
          <button className="btn sm primary" onClick={onClose} disabled={rows.some(r => r.status === 'looking')} title={rows.some(r => r.status === 'looking') ? 'انتظر حتى تُحفظ القطع الجارية' : undefined}><Check /> إنهاء</button>
        </div>
      </div>
      <p className="help">امسح باركود كل علبة بالقارئ أو بالكاميرا: تُضاف القطعة فوراً باسمها وصورتها {lookupEnabled() ? 'من قاعدة الباركود أو الإنترنت' : ''} دون كتابة، وكل مسح آخر لنفس القطعة يزيد كميتها. اكتب الأسعار هنا أو لاحقاً من فلتر «بلا سعر».</p>
      {rows.length > 0 && <div className="small muted mb">أُضيفت {added.length} قطعة · {boxes} علبة</div>}
      {rows.length === 0 ? <div className="scan-test empty">بانتظار أول مسح…</div> : (
        <div className="list">
          {rows.map(r => <IntakeRow key={r.key} row={r} product={r.productId ? products.get(r.productId) : undefined} later={later}
            // the editor opens once the row's own saves are done, with the part as it is now
            onEdit={p => later(async () => onEdit(latest(p.id) ?? p))} />)}
        </div>
      )}
      {camera && <CameraScanner onClose={() => setCamera(false)} hint="امسح العلب واحدة تلو الأخرى؛ تبقى الكاميرا مفتوحة. أغلقها عند الانتهاء." onCode={d => { take(d.text); return true }} />}
    </div>
  )
}

type Later = (job: () => Promise<void>) => void
function IntakeRow({ row, product: p, onEdit, later }: { row: Row; product?: Product; onEdit: (p: Product) => void; later: Later }) {
  const placeholder = !!p && /^قطعة\s+\S+$/.test(p.name)
  const toast = useToast()
  const [cam, setCam] = useState(false)
  const [reading, setReading] = useState(false)
  // no name anywhere: a photo of the box names it (and becomes its picture)
  const readBox = async (photo: Blob) => {
    if (!p) return
    setReading(true)
    try {
      const [pic, r] = await Promise.all([shrinkImage(photo), readBoxPhoto(photo)])
      if (!r) toast.error('لم نستطع قراءة اسم القطعة من الصورة. صوّر الوجه الذي عليه الاسم بوضوح.')
      const name = r ? (r.size && !norm(r.name).includes(norm(r.size)) ? `${r.name} ${r.size}` : r.name) : null
      later(async () => {
        const cur = latest(p.id)
        if (!cur) return
        const still = /^قطعة\s+\S+$/.test(cur.name)
        await put('products', { ...cur, image: cur.image || pic, name: name && still ? name : cur.name, brand: cur.brand || r?.brand || '', oemNumbers: cur.oemNumbers || r?.partNumber, cars: cur.cars || r?.cars || '' })
        if (name && still) void shareCatalogChanges()
      })
      if (name) toast.success(`قرأنا من الصورة: ${name}`)
    } catch (e) { toast.error((e as Error).message) } finally { setReading(false) }
  }
  return (
    <div className="list-item intake-row">
      {p?.image ? <img src={p.image} alt="" /> : <span className="intake-img" />}
      <div className="grow" style={{ minWidth: 0 }}>
        {row.status === 'looking' && <div className="title"><RefreshCw size={14} className="spin" style={{ verticalAlign: -2 }} /> جارٍ البحث عن اسمها…</div>}
        {p && (placeholder ? <NameCell product={p} later={later} /> : <div className="title">{p.name}</div>)}
        <div className="sub"><span className="mono" dir="ltr">{row.code}</span>
          {row.status === 'existing' && ' · موجودة مسبقاً (لم تتغير كميتها)'}
          {row.status === 'new' && (row.source ? <> · <Globe size={12} style={{ verticalAlign: -2 }} /> {SOURCE_LABEL[row.source]}</> : ' · لم يُعثر على اسمها — اكتبه')}
        </div>
      </div>
      {row.status !== 'existing' && <span className="badge tone-info" title="الكمية"><span className="mono">{row.count}</span></span>}
      {p && row.status === 'new' && <PriceCell product={p} later={later} />}
      {p && placeholder && API_URL && <button className="btn sm icon" title="صوّر العلبة لقراءة اسمها" aria-label="صوّر العلبة لقراءة اسمها" disabled={reading} onClick={() => setCam(true)}>{reading ? <RefreshCw className="spin" /> : <Camera />}</button>}
      {p && <button className="btn sm ghost icon" title="تعديل" aria-label="تعديل" onClick={() => onEdit(p)}><Pencil /></button>}
      {cam && <CameraScanner title="صوّر العلبة" onClose={() => setCam(false)} onPhoto={b => { void readBox(b) }} />}
    </div>
  )
}

/** The name, typed where it could not be found (saved on the latest copy of the part, in turn with other saves). */
function NameCell({ product: p, later }: { product: Product; later: Later }) {
  const [v, setV] = useState('')
  const save = () => { const name = v.trim(); if (name.length < 2) return; later(async () => { const cur = latest(p.id); if (cur) { await put('products', { ...cur, name }); void shareCatalogChanges() } }) }
  return <input className="input sm" placeholder="اكتب اسم القطعة" value={v} onChange={e => setV(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
}

/** The selling price, saved when the box loses the cursor; only what was typed here, never a stale copy. */
function PriceCell({ product: p, later }: { product: Product; later: Later }) {
  const [v, setV] = useState(p.price ? String(p.price) : '')
  const dirty = useRef(false)
  // the price changed elsewhere (the part's form): show it, unless something is being typed here
  useEffect(() => { if (!dirty.current) setV(p.price ? String(p.price) : '') }, [p.price])
  const save = () => {
    if (!dirty.current) return
    dirty.current = false
    const price = Math.max(0, toNumber(v))
    later(async () => { const cur = latest(p.id); if (cur && price !== cur.price) await put('products', { ...cur, price }) })
  }
  return <input className="input sm intake-price" inputMode="decimal" dir="ltr" placeholder="السعر" value={v} onChange={e => { dirty.current = true; setV(e.target.value) }} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} aria-label="سعر البيع" />
}

