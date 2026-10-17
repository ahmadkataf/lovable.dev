import { splitOem } from '../lib/vin'
import { useSettings } from '../db/store'
import type { Product } from '../db/types'
import { barcodeSvg } from '../lib/barcode'
import { money } from '../lib/format'

export interface LabelsDoc { products: { product: Product; copies: number }[]; size: 'small' | 'medium'; showPrice: boolean }

/** Shelf labels: name, code, barcode and (optionally) the price; a grid that fits A4 label sheets or a label printer. */
export function LabelsPrint({ products, size, showPrice }: LabelsDoc) {
  const s = useSettings()
  const w = size === 'small' ? 38 : 50, h = size === 'small' ? 21 : 30
  const items = products.flatMap(p => Array.from({ length: Math.max(1, p.copies) }, () => p.product))
  return (
    <div dir="rtl" style={{ fontFamily: 'var(--font)', color: '#000', background: '#fff', display: 'flex', flexWrap: 'wrap', gap: '2mm', padding: '4mm' }}>
      {items.map((p, i) => (
        <div key={i} style={{ width: `${w}mm`, height: `${h}mm`, border: '1px dashed #bbb', padding: '1.5mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', pageBreakInside: 'avoid' }}>
          <div style={{ fontSize: size === 'small' ? 8 : 10, fontWeight: 700, lineHeight: 1.2, maxHeight: size === 'small' ? '2.4em' : '2.4em', overflow: 'hidden' }}>{p.name}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
            <div dangerouslySetInnerHTML={{ __html: barcodeSvg(splitOem(p.barcode)[0] || p.code, { height: size === 'small' ? 22 : 30, module: 1, showText: true }) }} style={{ maxWidth: '70%', overflow: 'hidden' }} />
            {showPrice && <div style={{ fontSize: size === 'small' ? 9 : 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{money(p.price, { display: 'base' })}</div>}
          </div>
          {size !== 'small' && <div style={{ fontSize: 7, color: '#555' }}>{s.shopName}</div>}
        </div>
      ))}
    </div>
  )
}
