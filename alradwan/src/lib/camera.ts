// Reads every common barcode from the camera or from a photo, on every platform (Windows app, Android app,
// any browser) and without internet: ZXing compiled to WebAssembly, shipped inside the app. Loaded only
// when a scanner opens, so the rest of the app stays light.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import type { ReadResult, ReaderOptions } from 'zxing-wasm/reader'

type Reader = typeof import('zxing-wasm/reader')
let ready: Promise<Reader> | null = null

/** The .wasm bytes: fetch where it works, XHR for file:// pages (the Windows app). */
function loadBinary(url: string): Promise<ArrayBuffer> {
  return fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() }).catch(() => new Promise<ArrayBuffer>((res, rej) => {
    const x = new XMLHttpRequest()
    x.open('GET', url); x.responseType = 'arraybuffer'
    x.onload = () => (x.status === 200 || x.status === 0) && x.response ? res(x.response as ArrayBuffer) : rej(new Error('wasm ' + x.status))
    x.onerror = () => rej(new Error('wasm'))
    x.send()
  }))
}

/** Loads the decoder once (about 1 MB, from the app itself). */
export function loadDecoder(): Promise<Reader> {
  ready ??= (async () => {
    const [z, bin] = await Promise.all([import('zxing-wasm/reader'), loadBinary(new URL(wasmUrl, location.href).href)])
    await z.prepareZXingModule({ overrides: { wasmBinary: bin }, fireImmediately: true })
    return z
  })().catch(e => { ready = null; throw e })
  return ready
}

/** Every symbology the decoder knows: shop barcodes (EAN/UPC), part labels (Code 128/39/93, Codabar, ITF),
 *  GS1 DataBar, and 2D codes (QR, Micro QR, rMQR, Data Matrix, PDF417, Aztec, MaxiCode). */
// Plain text keeps the GS1 separator (ASCII 29) as a character, exactly as a USB scanner sends it
const OPTIONS: ReaderOptions = { formats: [], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 4, textMode: 'Plain' }

export interface Decoded { text: string; format: string; symbologyIdentifier: string }
const pick = (r: ReadResult[]): Decoded[] => r.filter(x => x.isValid && x.text).map(x => ({ text: x.text, format: x.format, symbologyIdentifier: x.symbologyIdentifier }))

export async function decodeImageData(img: ImageData, fast = false): Promise<Decoded[]> {
  const z = await loadDecoder()
  return pick(await z.readBarcodes(img, fast ? { ...OPTIONS, tryHarder: false, tryRotate: false, tryInvert: false } : OPTIONS))
}
/** Plain pixels of a picture, its long side at most `max`. */
function pixels(src: CanvasImageSource & { width: number; height: number }, w: number, h: number, max: number): ImageData {
  const k = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return ctx.getImageData(0, 0, c.width, c.height)
}

/** A still picture, read with every effort: a photo, a file, or one full-size frame of the live camera. */
export async function decodeStill(src: Blob | HTMLVideoElement | ImageBitmap): Promise<Decoded[]> {
  const z = await loadDecoder()
  const still: ReaderOptions = { ...OPTIONS, tryDenoise: true, maxNumberOfSymbols: 8 }
  let bmp: ImageBitmap | HTMLVideoElement | null = null
  let w = 0, h = 0
  try {
    if (src instanceof HTMLVideoElement) { bmp = src; w = src.videoWidth; h = src.videoHeight }
    // the browser decodes every picture format (WebP, HEIC where supported) and turns a phone photo upright
    else if (src instanceof Blob) { bmp = await createImageBitmap(src, { imageOrientation: 'from-image' }); w = bmp.width; h = bmp.height }
    else { bmp = src; w = src.width; h = src.height }
  } catch { bmp = null }
  if (bmp && w && h) {
    let r = pick(await z.readBarcodes(pixels(bmp, w, h, 2048), still))
    // a second look: larger, and with the other way of telling black from white (uneven light, glare)
    if (!r.length) r = pick(await z.readBarcodes(pixels(bmp, w, h, 4096), { ...still, binarizer: 'GlobalHistogram' }))
    if (bmp instanceof ImageBitmap && bmp !== src) bmp.close()
    if (r.length || !(src instanceof Blob)) return r
  }
  return src instanceof Blob ? pick(await z.readBarcodes(src, OPTIONS)) : []
}
/** A photo or a picture file (the fallback when live video is not available). */
export const decodeFile = (file: Blob) => decodeStill(file)

/** Barcodes without a check digit: one frame can misread them, so the live camera waits for two that agree. */
export const UNCHECKED = new Set(['Codabar', 'Code39', 'Code32', 'PZN', 'ITF', 'DXFilmEdge', 'Telepen'])

/** Arabic-friendly names for the formats ZXing reports. */
export function formatLabel(f: string): string {
  return f.replace('EAN13', 'EAN-13').replace('EAN8', 'EAN-8').replace('UPCA', 'UPC-A').replace('UPCE', 'UPC-E').replace('Code128', 'Code 128')
    .replace('Code39', 'Code 39').replace('Code93', 'Code 93').replace('QRCode', 'QR Code').replace('MicroQRCode', 'Micro QR').replace('DataMatrix', 'Data Matrix')
}
