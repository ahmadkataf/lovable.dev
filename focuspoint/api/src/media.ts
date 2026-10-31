// Images uploaded from the site editor, stored in D1 (no R2: one database holds everything, no extra bill).
// The browser resizes to ≤1600 px and compresses to WebP (JPEG fallback) before POST /v1/admin/media, so a row stays
// far below D1's 2 MB limit. Served publicly at /media/<id>.<ext> with an immutable cache: an id never changes content.
import { Buffer } from 'node:buffer'
import { contentMediaSrcs } from '../../shared/content'
import type { MediaItem, MediaUpload } from '../../shared/types'
import type { Env } from './env'
import { HttpError } from './http'

export const MEDIA_MAX_BYTES = 1_000_000
export type MediaMime = MediaItem['mime']
export const MEDIA_EXT: Record<MediaMime, 'webp' | 'jpg' | 'png'> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }
const MAX_DIM = 20000                       // same bound as a Photo's w/h in the content contract

// ---------- pure rules (unit-tested) ----------

export const isMediaMime = (v: unknown): v is MediaMime => typeof v === 'string' && Object.prototype.hasOwnProperty.call(MEDIA_EXT, v)

/** "image/webp; charset=…" → "image/webp" (lower case), or null when it is not one we accept. */
export function mediaMimeOf(contentType: string | null): MediaMime | null {
  const t = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  return isMediaMime(t) ? t : null
}

/** 16 lower-case hex characters (64 random bits): unguessable enough for public images, short in URLs. */
export function newMediaId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
export const MEDIA_ID_RE = /^[0-9a-f]{16}$/

export const mediaSrc = (id: string, mime: MediaMime): string => `/media/${id}.${MEDIA_EXT[mime]}`

/** "/media/<id>.<ext>" or "<id>.<ext>" → the id, else null. */
export function mediaIdOf(srcOrFile: string): string | null {
  const m = /^(?:\/media\/)?([0-9a-f]{16})\.(webp|jpg|jpeg|png)$/.exec(srcOrFile)
  return m?.[1] ?? null
}

/** The public file name → id + the mime its extension promises (jpeg and jpg are the same). */
export function parseMediaFile(file: string): { id: string; mime: MediaMime } | null {
  const m = /^([0-9a-f]{16})\.(webp|jpg|jpeg|png)$/.exec(file)
  if (!m?.[1] || !m[2]) return null
  const mime: MediaMime = m[2] === 'webp' ? 'image/webp' : m[2] === 'png' ? 'image/png' : 'image/jpeg'
  return { id: m[1], mime }
}

/** What the bytes really are (magic numbers), so a renamed file or a script with an image Content-Type is refused. */
export function sniffImage(b: Uint8Array): MediaMime | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp'
  return null
}

const ascii = (b: Uint8Array, at: number, n: number): string => String.fromCharCode(...b.subarray(at, at + n))
const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0)
const u32be = (b: Uint8Array, at: number) => (((b[at] ?? 0) << 24) >>> 0) + ((b[at + 1] ?? 0) << 16) + ((b[at + 2] ?? 0) << 8) + (b[at + 3] ?? 0)
const u24le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16)

/** Pixel size read from the image header (PNG IHDR, JPEG SOFn, WebP VP8/VP8L/VP8X), or null when it cannot be read. */
export function imageSize(b: Uint8Array, mime: MediaMime): { w: number; h: number } | null {
  const ok = (w: number, h: number) => (w >= 1 && h >= 1 && w <= MAX_DIM && h <= MAX_DIM ? { w, h } : null)
  if (mime === 'image/png') return b.length >= 24 && ascii(b, 12, 4) === 'IHDR' ? ok(u32be(b, 16), u32be(b, 20)) : null
  if (mime === 'image/webp') {
    const chunk = b.length >= 30 ? ascii(b, 12, 4) : ''
    if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return ok(((b[26] ?? 0) | ((b[27] ?? 0) << 8)) & 0x3fff, ((b[28] ?? 0) | ((b[29] ?? 0) << 8)) & 0x3fff)
    }
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const b1 = b[21] ?? 0, b2 = b[22] ?? 0, b3 = b[23] ?? 0, b4 = b[24] ?? 0
      return ok(1 + (b1 | ((b2 & 0x3f) << 8)), 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)))
    }
    if (chunk === 'VP8X') return ok(1 + u24le(b, 24), 1 + u24le(b, 27))
    return null
  }
  // JPEG: walk the segments to the first start-of-frame marker (not DHT C4, JPG C8, DAC CC).
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1] ?? 0
    if (marker === 0xff) { i++; continue }                       // fill byte
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return ok(u16be(b, i + 7), u16be(b, i + 5))
    if (marker === 0xd9 || marker === 0xda) return null           // end of image / start of scan before any frame header
    i += 2 + u16be(b, i + 2)
  }
  return null
}

/** Size from the query (?w=&h=, measured by the browser) when given and sane, else null. */
function querySize(w: string | null, h: string | null): { w: number; h: number } | null {
  if (w === null || h === null) return null
  const nw = Number(w), nh = Number(h)
  return Number.isInteger(nw) && Number.isInteger(nh) && nw >= 1 && nh >= 1 && nw <= MAX_DIM && nh <= MAX_DIM ? { w: nw, h: nh } : null
}

/**
 * Checks an upload: the declared type is one we accept, the bytes really are that type, 1…1,000,000 bytes, and a pixel
 * size is known (from the header; the browser's ?w=&h= when the header cannot be read).
 */
export function checkUpload(bytes: Uint8Array, contentType: string | null, qw: string | null, qh: string | null): { mime: MediaMime; w: number; h: number } {
  const mime = mediaMimeOf(contentType)
  if (!mime) throw new HttpError(415, 'unsupported_media_type')
  if (bytes.length === 0) throw new HttpError(400, 'empty_body')
  if (bytes.length > MEDIA_MAX_BYTES) throw new HttpError(413, 'media_too_large')
  if (sniffImage(bytes) !== mime) throw new HttpError(415, 'unsupported_media_type')
  const size = imageSize(bytes, mime) ?? querySize(qw, qh)
  if (!size) throw new HttpError(400, 'invalid_size')
  return { mime, ...size }
}

/**
 * Images are stored as base64 TEXT in the \`data\` column. A bound Uint8Array travels to D1 (and back) as a JSON
 * array of numbers — a 300 KB photo costs ~20 ms of CPU each way, over the free plan's 10 ms per request (Error 1102).
 * One base64 string is ~10× cheaper. Rows written as BLOB earlier still read through toBytes().
 */
export const toBase64 = (b: Uint8Array): string => Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString('base64')
export const fromBase64 = (s: string): Uint8Array => { const buf = Buffer.from(s, 'base64'); return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) }

/** D1 returns a BLOB column as an ArrayBuffer (workerd), but number[] / Uint8Array have been seen too: normalise. */
export function toBytes(v: unknown): Uint8Array | null {
  if (v instanceof Uint8Array) return v
  if (v instanceof ArrayBuffer) return new Uint8Array(v)
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
  if (Array.isArray(v) && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return Uint8Array.from(v as number[])
  return null
}

// ---------- storage ----------

interface MediaRow { id: string; mime: MediaMime; w: number | null; h: number | null; bytes: number | null; created_at: string | null }

const toItem = (r: MediaRow, used: Set<string>): MediaItem => ({
  id: r.id, src: mediaSrc(r.id, r.mime), w: r.w ?? 0, h: r.h ?? 0, bytes: r.bytes ?? 0, mime: r.mime, created_at: r.created_at ?? '', used: used.has(r.id),
})

/** Storage cap for uploaded images, far below D1's free-plan database size (500 MB), so the database can never grow
 *  into a cost or a limit problem. Unused images can be deleted from the editor to make room. */
export const MEDIA_MAX_COUNT = 300
export const MEDIA_MAX_TOTAL_BYTES = 150_000_000

export async function putMedia(db: D1Database, bytes: Uint8Array, info: { mime: MediaMime; w: number; h: number }, userId: number | null, now: Date): Promise<MediaUpload> {
  const full = async () => {
    const u = await db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS total FROM media').first<{ n: number; total: number }>()
    return !!u && (u.n >= MEDIA_MAX_COUNT || u.total + bytes.length > MEDIA_MAX_TOTAL_BYTES)
  }
  if (await full()) {
    // Make room: drop uploads nothing uses any more (replaced or removed photos) that are older than a day — a day so
    // an image uploaded in an editor that has not been saved yet is never taken away.
    const used = await usedMediaIds(db)
    const dayAgo = new Date(now.getTime() - 86_400_000).toISOString()
    const old = (await db.prepare('SELECT id FROM media WHERE created_at < ? ORDER BY created_at').bind(dayAgo).all<{ id: string }>()).results
    const unused = old.map((r) => r.id).filter((mid) => !used.has(mid))
    for (let i = 0; i < unused.length; i += 50) {
      const chunk = unused.slice(i, i + 50)
      await db.prepare(`DELETE FROM media WHERE id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).run()
    }
    if (await full()) throw new HttpError(413, 'media_quota')
  }
  const id = newMediaId()
  await db.prepare('INSERT INTO media (id, mime, data, w, h, bytes, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, info.mime, toBase64(bytes), info.w, info.h, bytes.length, now.toISOString(), userId).run()
  return { id, src: mediaSrc(id, info.mime), w: info.w, h: info.h, bytes: bytes.length }
}

export async function getMedia(db: D1Database, id: string): Promise<{ mime: MediaMime; data: Uint8Array } | null> {
  if (!MEDIA_ID_RE.test(id)) return null
  const row = await db.prepare('SELECT mime, data FROM media WHERE id = ?').bind(id).first<{ mime: MediaMime; data: unknown }>()
  const data = row ? (typeof row.data === 'string' ? fromBase64(row.data) : toBytes(row.data)) : null
  return row && data ? { mime: row.mime, data } : null
}

/** Ids of the uploaded images the site uses right now: anywhere in the saved content, or as a room photo. */
export async function usedMediaIds(db: D1Database): Promise<Set<string>> {
  const [content, photos] = await Promise.all([
    db.prepare('SELECT data FROM site_content WHERE id = 1').first<{ data: string }>(),
    db.prepare(`SELECT src, small FROM room_photos WHERE src LIKE '/media/%' OR small LIKE '/media/%'`).all<{ src: string; small: string | null }>(),
  ])
  const srcs: string[] = []
  if (content?.data) {
    // The raw stored JSON, not the merged content: whatever is saved counts as used, even a value the merge would skip.
    try { srcs.push(...contentMediaSrcs(JSON.parse(content.data))) } catch { /* malformed row: the merge ignores it too */ }
  }
  for (const p of photos.results) { srcs.push(p.src); if (p.small) srcs.push(p.small) }
  const ids = new Set<string>()
  for (const s of srcs) { const id = mediaIdOf(s); if (id) ids.add(id) }
  return ids
}

export async function listMedia(db: D1Database): Promise<MediaItem[]> {
  const [rows, used] = await Promise.all([
    db.prepare('SELECT id, mime, w, h, bytes, created_at FROM media ORDER BY created_at DESC, rowid DESC LIMIT 1000').all<MediaRow>(),
    usedMediaIds(db),
  ])
  return rows.results.map((r) => toItem(r, used))
}

/** 404 when unknown, 409 media_in_use while the content or a room photo still shows it. */
export async function deleteMedia(db: D1Database, id: string, origin?: string): Promise<void> {
  if (!MEDIA_ID_RE.test(id)) throw new HttpError(404, 'media_not_found')
  const exists = await db.prepare('SELECT 1 FROM media WHERE id = ?').bind(id).first()
  if (!exists) throw new HttpError(404, 'media_not_found')
  if ((await usedMediaIds(db)).has(id)) throw new HttpError(409, 'media_in_use')
  const row = await db.prepare('DELETE FROM media WHERE id = ? RETURNING mime').bind(id).first<{ mime: MediaMime }>()
  if (row && origin) await purgeMediaCache(origin, mediaSrc(id, row.mime))
}

/** Drops an image from this data centre's edge cache (serveMedia caches every image it serves). */
export async function purgeMediaCache(origin: string, src: string): Promise<void> {
  try {
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined
    await cache?.delete(new Request(origin + src, { method: 'GET' }))
  } catch { /* best effort: ids are never reused, so a cached copy of a deleted image harms nothing */ }
}

// ---------- GET /media/<id>.<ext> (outside /v1) ----------

const IMMUTABLE = 'public, max-age=31536000, immutable'
const notFound = () => new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function serveMedia(req: Request, env: Env, url: URL, exec?: ExecutionContext): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  const file = parseMediaFile(url.pathname.slice('/media/'.length))
  if (!file) return notFound()
  // Cloudflare's edge cache first: an image is read from D1 once per data centre, not once per visitor (ids never
  // change, so a cached copy is always right). Conditional requests skip the cache and get their 304 below.
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined
  const key = new Request(url.origin + url.pathname, { method: 'GET' })
  if (cache && req.method === 'GET' && !req.headers.get('If-None-Match')) {
    try { const hit = await cache.match(key); if (hit) return hit } catch { /* no cache: read D1 */ }
  }
  let media: Awaited<ReturnType<typeof getMedia>>
  try {
    media = await getMedia(env.DB, file.id)
  } catch (err) {
    console.error('GET /media', err)
    return new Response('Unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } })
  }
  if (!media || media.mime !== file.mime) return notFound()      // the extension must match what was uploaded
  const etag = `"${file.id}"`
  const headers: Record<string, string> = {
    'Content-Type': media.mime, 'Cache-Control': IMMUTABLE, ETag: etag, 'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*', 'Content-Length': String(media.data.length),
  }
  const inm = req.headers.get('If-None-Match')
  if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag || t.trim() === '*')) {
    const { 'Content-Length': _l, ...rest } = headers
    return new Response(null, { status: 304, headers: rest })
  }
  const res = new Response(req.method === 'HEAD' ? null : media.data, { status: 200, headers })
  if (cache && exec && req.method === 'GET') exec.waitUntil(cache.put(key, res.clone()).catch(() => { /* best effort */ }))
  return res
}
