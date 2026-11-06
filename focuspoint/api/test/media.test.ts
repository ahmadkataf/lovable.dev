// Uploaded images: id format, accepted types (checked against the bytes, not only the header), size limit, pixel size
// from the image header, file names and the D1 BLOB shapes.
import { describe, expect, it } from 'vitest'
import { HttpError } from '../src/http'
import {
  MEDIA_MAX_BYTES, checkUpload, imageSize, mediaIdOf, mediaMimeOf, mediaSrc, newMediaId, parseMediaFile, sniffImage, toBytes,
} from '../src/media'
import { etagMatches } from '../src/routes/content'

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
/** A real 1×1 lossless WebP (the classic feature-detection image). */
const WEBP_1x1 = b64('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==')
/** PNG signature + IHDR for 320 × 200 (enough for the header checks). */
const png = (w: number, h: number) => {
  const b = new Uint8Array(33)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(b.buffer).setUint32(16, w)
  new DataView(b.buffer).setUint32(20, h)
  return b
}
/** SOI, an APP0 segment, then SOF0 with 640 × 480. */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
])
/** RIFF/WEBP with a VP8X chunk: canvas 1600 × 900. */
const webpX = (() => {
  const b = new Uint8Array(30)
  b.set([0x52, 0x49, 0x46, 0x46, 22, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0])
  b.set([(1600 - 1) & 255, (1600 - 1) >> 8, 0, (900 - 1) & 255, (900 - 1) >> 8, 0], 24)
  return b
})()

const err = (fn: () => unknown): string | null => {
  try { fn(); return null } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : String(e) }
}

describe('media ids and names', () => {
  it('is 16 lower-case hex characters from 8 random bytes', () => {
    expect(newMediaId(() => new Uint8Array([0, 1, 0xab, 0xff, 16, 32, 64, 128]))).toBe('0001abff10204080')
    const ids = new Set(Array.from({ length: 200 }, () => newMediaId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/)
  })
  it('builds and parses the public file names', () => {
    expect(mediaSrc('0001abff10204080', 'image/webp')).toBe('/media/0001abff10204080.webp')
    expect(mediaSrc('0001abff10204080', 'image/jpeg')).toBe('/media/0001abff10204080.jpg')
    expect(mediaSrc('0001abff10204080', 'image/png')).toBe('/media/0001abff10204080.png')
    expect(parseMediaFile('0001abff10204080.webp')).toEqual({ id: '0001abff10204080', mime: 'image/webp' })
    expect(parseMediaFile('0001abff10204080.jpeg')).toEqual({ id: '0001abff10204080', mime: 'image/jpeg' })
    expect(parseMediaFile('0001abff10204080.gif')).toBeNull()
    expect(parseMediaFile('0001ABFF10204080.webp')).toBeNull()
    expect(parseMediaFile('../0001abff10204080.webp')).toBeNull()
    expect(parseMediaFile('0001abff1020408.webp')).toBeNull()
    expect(mediaIdOf('/media/0001abff10204080.png')).toBe('0001abff10204080')
    expect(mediaIdOf('0001abff10204080.webp')).toBe('0001abff10204080')
    expect(mediaIdOf('/img/room-a.webp')).toBeNull()
  })
})

describe('media types', () => {
  it('accepts only webp, jpeg and png (parameters and case ignored)', () => {
    expect(mediaMimeOf('image/webp')).toBe('image/webp')
    expect(mediaMimeOf('IMAGE/JPEG; charset=binary')).toBe('image/jpeg')
    expect(mediaMimeOf('image/png')).toBe('image/png')
    expect(mediaMimeOf('image/gif')).toBeNull()
    expect(mediaMimeOf('image/svg+xml')).toBeNull()
    expect(mediaMimeOf('text/html')).toBeNull()
    expect(mediaMimeOf(null)).toBeNull()
  })
  it('recognises the bytes', () => {
    expect(sniffImage(WEBP_1x1)).toBe('image/webp')
    expect(sniffImage(png(1, 1))).toBe('image/png')
    expect(sniffImage(JPEG)).toBe('image/jpeg')
    expect(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull()
    expect(sniffImage(new Uint8Array())).toBeNull()
  })
  it('reads the pixel size from the header', () => {
    expect(imageSize(WEBP_1x1, 'image/webp')).toEqual({ w: 1, h: 1 })
    expect(imageSize(webpX, 'image/webp')).toEqual({ w: 1600, h: 900 })
    expect(imageSize(png(320, 200), 'image/png')).toEqual({ w: 320, h: 200 })
    expect(imageSize(JPEG, 'image/jpeg')).toEqual({ w: 640, h: 480 })
    expect(imageSize(png(0, 5), 'image/png')).toBeNull()
    expect(imageSize(png(30000, 5), 'image/png')).toBeNull()
  })
})

describe('checkUpload', () => {
  it('returns the type and the size (header first, the browser\'s ?w=&h= as a fallback)', () => {
    expect(checkUpload(WEBP_1x1, 'image/webp', '999', '999')).toEqual({ mime: 'image/webp', w: 1, h: 1 })
    const noHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9, 0, 0])
    expect(checkUpload(noHeader, 'image/jpeg', '800', '600')).toEqual({ mime: 'image/jpeg', w: 800, h: 600 })
    expect(err(() => checkUpload(noHeader, 'image/jpeg', null, null))).toBe('400 invalid_size')
    expect(err(() => checkUpload(noHeader, 'image/jpeg', '0', '600'))).toBe('400 invalid_size')
  })
  it('refuses other types, a type that does not match the bytes, empty and oversized bodies', () => {
    expect(err(() => checkUpload(WEBP_1x1, 'image/gif', null, null))).toBe('415 unsupported_media_type')
    expect(err(() => checkUpload(WEBP_1x1, null, null, null))).toBe('415 unsupported_media_type')
    expect(err(() => checkUpload(WEBP_1x1, 'image/png', null, null))).toBe('415 unsupported_media_type')
    expect(err(() => checkUpload(new TextEncoder().encode('<script>'), 'image/png', '1', '1'))).toBe('415 unsupported_media_type')
    expect(err(() => checkUpload(new Uint8Array(), 'image/webp', '1', '1'))).toBe('400 empty_body')
    const big = new Uint8Array(MEDIA_MAX_BYTES + 1)
    big.set(png(10, 10))
    expect(err(() => checkUpload(big, 'image/png', null, null))).toBe('413 media_too_large')
    const max = new Uint8Array(MEDIA_MAX_BYTES)
    max.set(png(10, 10))
    expect(checkUpload(max, 'image/png', null, null)).toEqual({ mime: 'image/png', w: 10, h: 10 })
  })
})

describe('D1 BLOB values', () => {
  it('normalises ArrayBuffer, Uint8Array, other views and number[]', () => {
    const bytes = new Uint8Array([1, 2, 255])
    expect(toBytes(bytes)).toBe(bytes)
    expect([...toBytes(bytes.buffer)!]).toEqual([1, 2, 255])
    expect([...toBytes([1, 2, 255])!]).toEqual([1, 2, 255])
    expect([...toBytes(new DataView(new Uint8Array([9, 1, 2, 255]).buffer, 1))!]).toEqual([1, 2, 255])
    expect(toBytes([1, 256])).toBeNull()
    expect(toBytes('abc')).toBeNull()
    expect(toBytes(null)).toBeNull()
  })
})

describe('If-None-Match', () => {
  it('matches strong, weak, listed and * forms', () => {
    expect(etagMatches('"c-1"', '"c-1"')).toBe(true)
    expect(etagMatches('W/"c-1"', '"c-1"')).toBe(true)
    expect(etagMatches('"x", "c-1"', '"c-1"')).toBe(true)
    expect(etagMatches('*', '"c-1"')).toBe(true)
    expect(etagMatches('"c-2"', '"c-1"')).toBe(false)
    expect(etagMatches(null, '"c-1"')).toBe(false)
  })
})
