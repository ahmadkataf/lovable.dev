// A barcode drawn as SVG (JsBarcode). Picks EAN-13 / EAN-8 / UPC when the value is valid, else CODE128;
// a value that cannot be encoded at all falls back to plain text. Never throws.
import { useLayoutEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { barcodeFormat, cleanBarcode } from '../lib/barcode'

export interface BarcodeImageProps {
  value: string
  height?: number
  /** Width of the thinnest bar in px. */
  width?: number
  showText?: boolean
  className?: string
}

function draw(el: SVGSVGElement, value: string, format: string, height: number, width: number, showText: boolean): boolean {
  let ok = true
  try {
    JsBarcode(el, value, {
      format, height, width, displayValue: showText, margin: 0, textMargin: 2, fontSize: 12,
      font: 'ui-monospace, Menlo, Consolas, monospace', background: 'transparent', lineColor: 'currentColor',
      valid: v => { ok = v },
    })
  } catch { ok = false }
  return ok && el.childNodes.length > 0
}

export function BarcodeImage({ value, height = 50, width = 2, showText = true, className = '' }: BarcodeImageProps) {
  const ref = useRef<SVGSVGElement>(null)
  const [failed, setFailed] = useState(false)
  const clean = cleanBarcode(value ?? '')

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!clean) { setFailed(true); return }
    const primary = barcodeFormat(clean)
    let ok = draw(el, clean, primary, height, width, showText)
    if (!ok && primary !== 'CODE128') ok = draw(el, clean, 'CODE128', height, width, showText)
    if (!ok) { while (el.firstChild) el.removeChild(el.firstChild) }
    setFailed(!ok)
  }, [clean, height, width, showText])

  if (!clean || failed) {
    return <span className={`mono ltr ${className}`} style={{ display: 'inline-block', minHeight: height, lineHeight: `${height}px` }}>{value}</span>
  }
  return <svg ref={ref} className={`ltr ${className}`} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} role="img" aria-label={clean} />
}
