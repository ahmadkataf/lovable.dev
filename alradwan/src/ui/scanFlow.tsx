import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanLine, ShoppingCart, Pencil, MapPin } from 'lucide-react'
import { useCollection, usePerm } from '../db/store'
import type { Product } from '../db/types'
import { emitScan, focusedField, insertIntoField, SCAN_PRIORITY, startKeyboardScanner, useScan, type Scan } from '../lib/scan'
import { findProductByScan, prefillFromScan, type MatchVia } from '../lib/productMatch'
import { formatLabel, type Decoded } from '../lib/camera'
import { CameraScanner } from './scanner'
import { Modal, dialogDepth } from './modal'
import { ProductForm } from './forms'
import { useProductStock } from './pickers'
import { Price } from './components'
import { useToast } from './toast'
import { startDeviceScanners } from '../lib/devices'

/** Mounted once for the signed-in app: starts listening to scanners and catches the readings no screen
 *  took. A known product shows its card; an unknown code opens a new product with the barcode filled in. */
export function ScanHost() {
  const products = useCollection('products')
  const canAdd = usePerm('products')
  const toast = useToast()
  const [card, setCard] = useState<{ id: string; via: MatchVia; scan: Scan } | null>(null)
  const [create, setCreate] = useState<{ initial: Partial<Product>; scan: string } | null>(null)
  useEffect(() => { startKeyboardScanner(); void startDeviceScanners() }, [])
  useScan(s => {
    const field = focusedField()
    // a reading into a field no screen claimed is typed there, as a scanner always did
    if (field && (s.source === 'keyboard' || dialogDepth() > 0)) { insertIntoField(field, s.text); return true }
    if (dialogDepth() > 0) return false
    const hit = findProductByScan(products.values(), s.text)
    if (hit) { setCard({ id: hit.product.id, via: hit.via, scan: s }); return true }
    if (canAdd) { setCreate({ initial: prefillFromScan(s.text), scan: s.text }); return true }
    toast.error(`الرمز ${s.text} غير مسجّل لأي قطعة`)
    return false
  }, { priority: SCAN_PRIORITY.fallback })
  const cardProduct = card ? products.get(card.id) : undefined
  return <>
    {card && cardProduct && <ProductCard product={cardProduct} onClose={() => setCard(null)} />}
    {create && <ProductForm initial={create.initial} scanned={create.scan} onClose={() => setCreate(null)} />}
  </>
}

/** What a scanned product is: price, stock and shelf, with a shortcut to sell it or edit it. */
function ProductCard({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const stock = useProductStock()
  const nav = useNavigate()
  const canSell = usePerm('sell')
  const [edit, setEdit] = useState(false)
  const st = stock.get(p.id) ?? 0
  if (edit) return <ProductForm initial={p} currentStock={st} onClose={onClose} />
  return (
    <Modal title={p.name} onClose={onClose} size="narrow" footer={<>
      {canSell && <button className="btn primary" onClick={() => { onClose(); nav(`/pos?add=${p.id}`) }}><ShoppingCart /> بيع</button>}
      <button className="btn" onClick={() => setEdit(true)}><Pencil /> التفاصيل</button>
      <button className="btn" onClick={onClose}>إغلاق</button>
    </>}>
      <div className="stack" style={{ gap: 10 }}>
        {p.image && <img src={p.image} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10 }} />}
        <div className="between"><span className="muted">سعر البيع</span><b style={{ fontSize: 20 }}><Price value={p.price} /></b></div>
        {!!p.wholesalePrice && <div className="between"><span className="muted">سعر الجملة</span><Price value={p.wholesalePrice} /></div>}
        {p.kind === 'product'
          ? <div className="between"><span className="muted">الكمية في المحل</span><span className={`badge ${st <= 0 ? 'tone-danger' : st <= p.minStock ? 'tone-warning' : 'tone-success'}`}><span className="mono">{st}</span> {p.unit}</span></div>
          : <div className="between"><span className="muted">النوع</span><span className="badge tone-info">خدمة</span></div>}
        {p.location && <div className="between"><span className="muted">المكان</span><span><MapPin size={14} style={{ verticalAlign: -2 }} /> {p.location}</span></div>}
        <div className="between"><span className="muted">الكود</span><span className="mono" dir="ltr">{p.code}</span></div>
        {p.brand && <div className="between"><span className="muted">الماركة</span><span>{p.brand}</span></div>}
        {p.cars && <div className="small muted">{p.cars}</div>}
      </div>
    </Modal>
  )
}

/** A camera button whose readings go where a scanner's would: the sale, the product list, the product card. */
export function ScanButton({ label, className = 'btn ghost icon' }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState<Decoded | null>(null)
  // hand the reading on once the camera window has closed, so the screen underneath takes it
  useEffect(() => {
    if (open || !read) return
    setRead(null)
    void emitScan({ text: read.text, source: 'camera', symbology: formatLabel(read.format), quiet: true })
  }, [open, read])
  return <>
    <button className={className} title="مسح باركود بالكاميرا" aria-label="مسح باركود بالكاميرا" onClick={() => setOpen(true)}><ScanLine />{label && <span className="hide-mobile">{label}</span>}</button>
    {open && <CameraScanner onClose={() => setOpen(false)} onCode={d => { setRead(d) }} />}
  </>
}
