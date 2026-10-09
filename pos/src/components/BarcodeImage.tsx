// PLACEHOLDER — the scanner module replaces this file (JsBarcode → SVG).
export function BarcodeImage({ value, height = 50 }: { value: string; height?: number; showText?: boolean; width?: number }) {
  return <div className="mono ltr" style={{ height }}>{value}</div>
}
