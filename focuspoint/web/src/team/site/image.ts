// Turns a photo picked on the phone/computer into an upload the API accepts: ≤1600 px on the longest side, WebP
// (quality ≈0.82) or JPEG where the browser cannot encode WebP (Safari), ≤1,000,000 bytes. Done in the browser so a
// 12 MB camera photo becomes ~200 KB before it leaves the phone. Errors are friendly Arabic sentences.

export const MAX_SIDE = 1600
export const MAX_BYTES = 1_000_000
const MAX_INPUT_BYTES = 40 * 1024 * 1024       // a file this big is not a photo we can handle on a phone
const CANVAS_AREA = 16_000_000                 // iOS refuses canvases above ~16.7 MP

export type UploadMime = 'image/webp' | 'image/jpeg' | 'image/png'
export interface PreparedImage { blob: Blob; w: number; h: number; mime: UploadMime }

export class ImageError extends Error {}

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = url
  }).finally(() => { setTimeout(() => URL.revokeObjectURL(url), 0) })
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new ImageError('المتصفح ما قدر يجهّز الصورة. جرّب متصفح تاني')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { c, ctx }
}

/** Downscale in halving steps (sharper than one big jump in browsers with a simple filter). */
function scaleTo(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  let src: CanvasImageSource = img
  let sw = img.naturalWidth, sh = img.naturalHeight
  while (sw / 2 > w && (sw / 2) * (sh / 2) <= CANVAS_AREA) {
    const nw = Math.round(sw / 2), nh = Math.round(sh / 2)
    const step = canvas(nw, nh)
    step.ctx.drawImage(src, 0, 0, nw, nh)
    src = step.c; sw = nw; sh = nh
  }
  const out = canvas(w, h)
  out.ctx.drawImage(src, 0, 0, w, h)
  return out.c
}

function toBlob(c: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((resolve) => { try { c.toBlob((b) => resolve(b), type, q) } catch { resolve(null) } })
}

/** JPEG has no transparency: paint white behind (the site is white). */
function flatten(c: HTMLCanvasElement): HTMLCanvasElement {
  const out = canvas(c.width, c.height)
  out.ctx.fillStyle = '#ffffff'
  out.ctx.fillRect(0, 0, c.width, c.height)
  out.ctx.drawImage(c, 0, 0)
  return out.c
}

async function encode(c: HTMLCanvasElement): Promise<{ blob: Blob; mime: UploadMime } | null> {
  for (const q of [0.82, 0.72, 0.62]) {
    const b = await toBlob(c, 'image/webp', q)
    if (!b || b.type !== 'image/webp') break        // this browser cannot write WebP (it hands back PNG): use JPEG
    if (b.size <= MAX_BYTES) return { blob: b, mime: 'image/webp' }
  }
  const flat = flatten(c)
  for (const q of [0.85, 0.75, 0.65]) {
    const b = await toBlob(flat, 'image/jpeg', q)
    if (b && b.type === 'image/jpeg' && b.size <= MAX_BYTES) return { blob: b, mime: 'image/jpeg' }
  }
  return null
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.type && !file.type.startsWith('image/') && !isHeic(file)) throw new ImageError('هالملف مو صورة. اختار صورة JPG أو PNG أو WebP')
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('الصورة كبيرة كتير (أكتر من 40 ميغا). اختار صورة أصغر')
  let img: HTMLImageElement
  try { img = await loadImage(file) } catch {
    throw new ImageError(isHeic(file)
      ? 'صور HEIC من الآيفون ما بتنفتح بهالمتصفح. من إعدادات الكاميرا اختار «الأكثر توافقاً»، أو ابعت الصورة لنفسك عالواتساب ونزّلها من هناك'
      : 'ما قدرنا نفتح الصورة. جرّب صورة تانية (JPG أو PNG أو WebP)')
  }
  const nw = img.naturalWidth, nh = img.naturalHeight
  if (!nw || !nh) throw new ImageError('ما قدرنا نقرأ أبعاد الصورة. جرّب صورة تانية')
  for (const side of [MAX_SIDE, 1280, 1024]) {
    const s = Math.min(1, side / Math.max(nw, nh))
    const w = Math.max(1, Math.round(nw * s)), h = Math.max(1, Math.round(nh * s))
    const out = await encode(scaleTo(img, w, h))
    if (out) return { ...out, w, h }
  }
  throw new ImageError('الصورة كبيرة حتى بعد التصغير. جرّب صورة تانية')
}
