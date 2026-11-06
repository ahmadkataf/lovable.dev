// Byte helpers shared by the platform layer and the backup archive: CRC-32 (the checksum ZIP uses, and the one the
// Windows and Android shells check a saved file against), base64 without data: URLs, and a buffer that gathers
// small writes into large chunks before they cross IPC or the Android bridge.

// ---- CRC-32 (IEEE 802.3, the zlib/ZIP polynomial), slicing-by-8 -----------------------------------------------
const TABLE = (() => {
  const t = new Int32Array(256 * 8)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  for (let n = 0; n < 256; n++) {
    let c = t[n]
    for (let k = 1; k < 8; k++) { c = t[c & 0xff] ^ (c >>> 8); t[k * 256 + n] = c }
  }
  return t
})()

/** CRC-32 of `bytes`, continuing from `crc` (the value returned for the previous piece; 0 to start). */
export function crc32(bytes: Uint8Array, crc = 0): number {
  const T = TABLE
  let c = ~crc
  let i = 0
  const n = bytes.length
  for (; i + 8 <= n; i += 8) {
    const one = c ^ (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24))
    c = T[1792 + (one & 0xff)] ^ T[1536 + ((one >>> 8) & 0xff)] ^ T[1280 + ((one >>> 16) & 0xff)] ^ T[1024 + (one >>> 24)]
      ^ T[768 + bytes[i + 4]] ^ T[512 + bytes[i + 5]] ^ T[256 + bytes[i + 6]] ^ T[bytes[i + 7]]
  }
  for (; i < n; i++) c = T[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

// ---- base64 ---------------------------------------------------------------------------------------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_INDEX = (() => {
  const m = new Int16Array(128).fill(-1)
  for (let i = 0; i < B64.length; i++) m[B64.charCodeAt(i)] = i
  m['-'.charCodeAt(0)] = 62; m['_'.charCodeAt(0)] = 63   // base64url too
  return m
})()

/** Bytes → base64 (no line breaks). Works on any size without building a "binary string" first. */
export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = []
  const STEP = 3 * 16384
  for (let start = 0; start < bytes.length; start += STEP) {
    const end = Math.min(bytes.length, start + STEP)
    let s = ''
    let i = start
    for (; i + 3 <= end; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
      s += B64[n >>> 18] + B64[(n >>> 12) & 63] + B64[(n >>> 6) & 63] + B64[n & 63]
    }
    if (i < end) {
      const rest = end - i
      const n = (bytes[i] << 16) | (rest > 1 ? bytes[i + 1] << 8 : 0)
      s += B64[n >>> 18] + B64[(n >>> 12) & 63] + (rest > 1 ? B64[(n >>> 6) & 63] : '=') + '='
    }
    parts.push(s)
  }
  return parts.join('')
}

/** base64 (or base64url; whitespace ignored) → bytes. Throws on any other character. */
export function fromBase64(text: string): Uint8Array {
  let len = 0
  const clean = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 61) break                                                 // '=' padding: the end
    if (c === 32 || c === 10 || c === 13 || c === 9) continue
    const v = c < 128 ? B64_INDEX[c] : -1
    if (v < 0) throw new Error('bad-base64')
    clean[len++] = v
  }
  if (len % 4 === 1) throw new Error('bad-base64')
  const out = new Uint8Array(Math.floor((len * 3) / 4))
  let o = 0, i = 0
  for (; i + 4 <= len; i += 4) {
    const n = (clean[i] << 18) | (clean[i + 1] << 12) | (clean[i + 2] << 6) | clean[i + 3]
    out[o++] = n >>> 16; out[o++] = (n >>> 8) & 0xff; out[o++] = n & 0xff
  }
  if (len - i === 2) out[o++] = ((clean[i] << 18) | (clean[i + 1] << 12)) >>> 16
  else if (len - i === 3) { const n = (clean[i] << 18) | (clean[i + 1] << 12) | (clean[i + 2] << 6); out[o++] = n >>> 16; out[o++] = (n >>> 8) & 0xff }
  return out
}

// ---- chunking -------------------------------------------------------------------------------------------------
/**
 * Gathers small writes (ZIP headers of a few bytes, JSON pieces) into chunks of `size` bytes and hands each full
 * chunk to `flush`. Every chunk is a fresh array the caller may keep.
 */
export class ChunkBuffer {
  private buf: Uint8Array
  private used = 0
  constructor(private readonly size: number, private readonly flush: (chunk: Uint8Array) => Promise<void>) {
    this.buf = new Uint8Array(size)
  }
  async write(bytes: Uint8Array): Promise<void> {
    let off = 0
    while (off < bytes.length) {
      if (this.used === 0 && bytes.length - off >= this.size) {
        // a large piece goes through as is (copied, so the caller may reuse its array)
        const piece = bytes.slice(off, off + this.size)
        off += piece.length
        await this.flush(piece)
        continue
      }
      const n = Math.min(this.size - this.used, bytes.length - off)
      this.buf.set(bytes.subarray(off, off + n), this.used)
      this.used += n; off += n
      if (this.used === this.size) await this.drain()
    }
  }
  /** Sends what is buffered (the last, shorter chunk). */
  async end(): Promise<void> { if (this.used) await this.drain() }
  private async drain(): Promise<void> {
    const chunk = this.buf.slice(0, this.used)
    this.used = 0
    await this.flush(chunk)
  }
}

/**
 * Builds one Blob from many chunks without keeping them all in the JavaScript heap: every `every` bytes the pending
 * chunks become a Blob (the browser moves Blob data out of the page, and pages it to disk when it is large).
 */
export class BlobBuilder {
  private parts: Blob[] = []
  private pending: Uint8Array[] = []
  private pendingBytes = 0
  size = 0
  constructor(private readonly every = 32 * 1024 * 1024) {}
  push(bytes: Uint8Array): void {
    if (!bytes.length) return
    this.pending.push(bytes)
    this.pendingBytes += bytes.length
    this.size += bytes.length
    if (this.pendingBytes >= this.every) this.seal()
  }
  build(type = ''): Blob {
    this.seal()
    const b = new Blob(this.parts, { type })
    this.parts = []
    return b
  }
  private seal(): void {
    if (!this.pending.length) return
    this.parts.push(new Blob(this.pending as BlobPart[]))
    this.pending = []
    this.pendingBytes = 0
  }
}

/** Reads `blob` in slices of `step` bytes (never the whole file at once). */
export async function* readBlob(blob: Blob, step = 4 * 1024 * 1024, start = 0, end = blob.size): AsyncGenerator<Uint8Array> {
  for (let off = start; off < end; off += step) {
    const buf = await blob.slice(off, Math.min(end, off + step)).arrayBuffer()
    yield new Uint8Array(buf)
  }
}

/** Reads one byte range of a Blob. */
export async function readRange(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer())
}
