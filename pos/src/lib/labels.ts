// Price labels (shelf tags / stickers): one printable HTML document, one label per copy.
// Roll sizes get one page per label (@page size in mm); A4 gets a grid of labels.
import JsBarcode from 'jsbarcode'
import type { Settings } from '../db/types'
import { formatMoney } from './money'
import { barcodeFormat, cleanBarcode } from './barcode'
import { platform } from './platform'

export type LabelSize = '38x25' | '50x30' | '58x40' | 'a4'
export interface LabelItem { name: string; price: number; barcode: string; copies?: number }
export interface LabelOptions {
  size: LabelSize
  /** Print the store name on top of every label (default true when the store has a name). */
  showStore?: boolean
}

export const LABEL_SIZES: { id: LabelSize; w: number; h: number }[] = [
  { id: '38x25', w: 38, h: 25 },
  { id: '50x30', w: 50, h: 30 },
  { id: '58x40', w: 58, h: 40 },
  { id: 'a4', w: 210, h: 297 },
]
// A4 sheets: 4 columns x 10 rows (48.5 x 27.5 mm cells inside 8 mm margins) — the common 40-per-sheet layout.
const A4 = { cols: 4, rows: 10, cellH: 27.5 }

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The barcode as an SVG string (empty when there is no DOM or the value cannot be encoded). Never throws. */
export function barcodeSvg(value: string, opts: { height?: number; width?: number } = {}): string {
  if (typeof document === 'undefined' || typeof XMLSerializer === 'undefined') return ''
  const v = cleanBarcode(value)
  if (!v) return ''
  const render = (format: string): string | null => {
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      let ok = true
      JsBarcode(svg, v, {
        format, height: opts.height ?? 40, width: opts.width ?? 1.6, displayValue: false, margin: 0,
        background: 'transparent', lineColor: '#000', valid: x => { ok = x },
      })
      if (!ok || !svg.childNodes.length) return null
      return new XMLSerializer().serializeToString(svg)
    } catch { return null }
  }
  return render(barcodeFormat(v)) ?? (barcodeFormat(v) !== 'CODE128' ? render('CODE128') : null) ?? ''
}

/** How many labels a print run makes (copies default to 1). */
export function countLabels(items: LabelItem[]): number {
  return items.reduce((n, i) => n + Math.max(0, Math.floor(i.copies ?? 1)), 0)
}

function fontSizes(size: LabelSize): { store: number; name: number; price: number; code: number; barH: number; nameLines: number } {
  switch (size) {
    case '38x25': return { store: 5.5, name: 7, price: 10, code: 6, barH: 7, nameLines: 2 }
    case '50x30': return { store: 6, name: 8.5, price: 12.5, code: 6.5, barH: 9, nameLines: 2 }
    case '58x40': return { store: 7, name: 10, price: 15, code: 7.5, barH: 12, nameLines: 3 }
    default: return { store: 6, name: 8.5, price: 12, code: 6.5, barH: 8, nameLines: 2 }
  }
}

/** A complete HTML document with every label (one `.label` element per copy). */
export function labelsHtml(items: LabelItem[], settings: Settings, opts: LabelOptions): string {
  const size = LABEL_SIZES.find(s => s.id === opts.size) ?? LABEL_SIZES[1]
  const roll = size.id !== 'a4'
  const f = fontSizes(size.id)
  const store = settings.store.name.trim()
  const showStore = (opts.showStore ?? true) && store !== ''
  const dir = settings.lang === 'en' ? 'ltr' : 'rtl'

  const labels: string[] = []
  for (const item of items) {
    const copies = Math.max(0, Math.floor(item.copies ?? 1))
    if (!copies) continue
    const code = cleanBarcode(item.barcode || '')
    const svg = code ? barcodeSvg(code, { height: 40, width: 1.6 }) : ''
    const one = [
      '<div class="label">',
      showStore ? `<div class="store">${esc(store)}</div>` : '',
      `<div class="name">${esc(item.name)}</div>`,
      `<div class="price">${esc(formatMoney(item.price, settings.currency))}</div>`,
      code ? `<div class="bc">${svg}</div><div class="code">${esc(code)}</div>` : '<div class="bc empty"></div>',
      '</div>',
    ].join('')
    for (let i = 0; i < copies; i++) labels.push(one)
  }

  const page = roll
    ? `@page { size: ${size.w}mm ${size.h}mm; margin: 0; }`
    : '@page { size: A4; margin: 8mm; }'
  const labelBox = roll
    ? `.label { width: ${size.w}mm; height: ${size.h}mm; page-break-after: always; break-after: page; }
       .label:last-child { page-break-after: auto; break-after: auto; }`
    : `.sheet { display: grid; grid-template-columns: repeat(${A4.cols}, 1fr); grid-auto-rows: ${A4.cellH}mm; gap: 2mm; }
       .label { height: ${A4.cellH}mm; border: 0.2mm dashed #bbb; border-radius: 1mm; }`

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; color: #000; font-family: 'Alexandria', 'Segoe UI', Tahoma, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    ${page}
    ${labelBox}
    .label { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 1.2mm 1.5mm; overflow: hidden; }
    .store { font-size: ${f.store}pt; color: #333; line-height: 1.15; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name { font-size: ${f.name}pt; font-weight: 600; line-height: 1.2; max-width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: ${f.nameLines}; -webkit-box-orient: vertical; word-break: break-word; }
    .price { font-size: ${f.price}pt; font-weight: 800; line-height: 1.15; margin-top: 0.4mm; direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .bc { width: 100%; height: ${f.barH}mm; margin-top: 0.6mm; display: flex; align-items: flex-end; justify-content: center; }
    .bc svg { width: 92%; height: 100%; }
    .bc.empty { height: 0; margin: 0; }
    .code { font-size: ${f.code}pt; font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.15mm; direction: ltr; unicode-bidi: isolate; line-height: 1.1; }
  `
  const body = roll ? labels.join('') : `<div class="sheet">${labels.join('')}</div>`
  return `<!doctype html><html lang="${settings.lang}" dir="${dir}"><head><meta charset="utf-8"><title>labels</title><style>${css}</style></head><body>${body}</body></html>`
}

/** Builds the document and sends it to the printer (roll printers get their width in mm). */
export async function printLabels(items: LabelItem[], settings: Settings, opts: LabelOptions): Promise<boolean> {
  const size = LABEL_SIZES.find(s => s.id === opts.size)
  const html = labelsHtml(items, settings, opts)
  return platform.print(html, { widthMm: size && size.id !== 'a4' ? size.w : undefined })
}
