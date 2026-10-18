// A small ZIP writer and reader made for backups of any size.
// - The writer streams: each entry is written once, in order, with a data descriptor after it (sizes and CRC are
//   known only at the end), and ZIP64 records when the archive passes 4 GB. Nothing is held in memory but one chunk.
// - The reader works on a Blob (a picked File): it reads the central directory at the end and slices entries out
//   of the file. A stored entry becomes a Blob slice of the file, so restoring gigabytes of x-rays copies nothing.
// Any standard unzip tool opens these archives too.
import { Deflate, inflateSync } from 'fflate'
import { crc32, readRange } from '@/platform/bytes'

const SIG_LOCAL = 0x04034b50
const SIG_DESCRIPTOR = 0x08074b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
const SIG_ZIP64_EOCD = 0x06064b50
const SIG_ZIP64_LOCATOR = 0x07064b50
const MAX32 = 0xffffffff
const FLAGS = 0x0808               // bit 3: sizes in the data descriptor; bit 11: UTF-8 names

export class ZipError extends Error { constructor(message: string) { super(message); this.name = 'ZipError' } }

const enc = new TextEncoder()
const dec = new TextDecoder('utf-8', { fatal: false })

function dosDateTime(d: Date): { time: number; date: number } {
  const y = Math.max(1980, d.getFullYear())
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}
function put64(v: DataView, at: number, n: number) {
  v.setUint32(at, n % 0x100000000, true)
  v.setUint32(at + 4, Math.floor(n / 0x100000000), true)
}
const get64 = (v: DataView, at: number) => v.getUint32(at, true) + v.getUint32(at + 4, true) * 0x100000000

interface Written { name: Uint8Array; method: number; crc: number; csize: number; usize: number; offset: number; time: number; date: number }

/** Writes a ZIP archive to `out`, entry after entry. */
export class ZipWriter {
  private offset = 0
  private readonly entries: Written[] = []
  private readonly stamp: { time: number; date: number }
  constructor(private readonly out: (bytes: Uint8Array) => Promise<void>, when: Date = new Date()) {
    this.stamp = dosDateTime(when)
  }

  get bytesWritten(): number { return this.offset }

  private async emit(bytes: Uint8Array): Promise<void> {
    this.offset += bytes.length
    await this.out(bytes)
  }

  private async header(name: Uint8Array, method: number): Promise<number> {
    const at = this.offset
    const h = new Uint8Array(30 + name.length)
    const v = new DataView(h.buffer)
    v.setUint32(0, SIG_LOCAL, true)
    v.setUint16(4, 45, true)
    v.setUint16(6, FLAGS, true)
    v.setUint16(8, method, true)
    v.setUint16(10, this.stamp.time, true)
    v.setUint16(12, this.stamp.date, true)
    // CRC and sizes stay 0 here: they follow the data (bit 3)
    v.setUint16(26, name.length, true)
    h.set(name, 30)
    await this.emit(h)
    return at
  }

  private async descriptor(crc: number, csize: number, usize: number): Promise<void> {
    if (csize > MAX32 || usize > MAX32) throw new ZipError('entry-too-large')
    const d = new Uint8Array(16)
    const v = new DataView(d.buffer)
    v.setUint32(0, SIG_DESCRIPTOR, true)
    v.setUint32(4, crc, true)
    v.setUint32(8, csize, true)
    v.setUint32(12, usize, true)
    await this.emit(d)
  }

  /** Adds an entry kept as is (pictures and PDFs are compressed already). Returns its size and CRC-32. */
  async addStored(name: string, data: AsyncIterable<Uint8Array> | Iterable<Uint8Array>): Promise<{ size: number; crc: number }> {
    const n = enc.encode(name)
    const offset = await this.header(n, 0)
    let crc = 0, size = 0
    for await (const chunk of data) {
      crc = crc32(chunk, crc)
      size += chunk.length
      await this.emit(chunk)
    }
    await this.descriptor(crc, size, size)
    this.entries.push({ name: n, method: 0, crc, csize: size, usize: size, offset, ...this.stamp })
    return { size, crc }
  }

  /** Adds a compressed entry (JSON). */
  async addDeflated(name: string, data: AsyncIterable<Uint8Array> | Iterable<Uint8Array>): Promise<{ size: number; crc: number }> {
    const n = enc.encode(name)
    const offset = await this.header(n, 8)
    let crc = 0, usize = 0, csize = 0
    let pending: Uint8Array[] = []
    const z = new Deflate({ level: 6 }, chunk => { pending.push(chunk.slice()) })   // our own copy: the sink may keep it
    const drain = async () => {
      const list = pending
      pending = []
      for (const c of list) { csize += c.length; await this.emit(c) }
    }
    for await (const chunk of data) {
      crc = crc32(chunk, crc)
      usize += chunk.length
      // feed in slices so a large piece of JSON never blocks the page for long
      for (let i = 0; i < chunk.length; i += 512 * 1024) {
        z.push(chunk.subarray(i, Math.min(chunk.length, i + 512 * 1024)), false)
        await drain()
      }
    }
    z.push(new Uint8Array(0), true)
    await drain()
    await this.descriptor(crc, csize, usize)
    this.entries.push({ name: n, method: 8, crc, csize, usize, offset, ...this.stamp })
    return { size: usize, crc }
  }

  /** Writes the central directory (and the ZIP64 records when needed). Call once, last. */
  async finish(): Promise<number> {
    const cdStart = this.offset
    for (const e of this.entries) {
      const big = e.offset >= MAX32
      const extra = big ? 12 : 0
      const c = new Uint8Array(46 + e.name.length + extra)
      const v = new DataView(c.buffer)
      v.setUint32(0, SIG_CENTRAL, true)
      v.setUint16(4, (3 << 8) | 45, true)        // made by: UNIX, spec 4.5
      v.setUint16(6, 45, true)
      v.setUint16(8, FLAGS, true)
      v.setUint16(10, e.method, true)
      v.setUint16(12, e.time, true)
      v.setUint16(14, e.date, true)
      v.setUint32(16, e.crc, true)
      v.setUint32(20, e.csize, true)
      v.setUint32(24, e.usize, true)
      v.setUint16(28, e.name.length, true)
      v.setUint16(30, extra, true)
      v.setUint32(38, (0o100644 << 16) >>> 0, true)   // a regular file, rw-r--r--
      v.setUint32(42, big ? MAX32 : e.offset, true)
      c.set(e.name, 46)
      if (big) {
        const at = 46 + e.name.length
        v.setUint16(at, 0x0001, true)
        v.setUint16(at + 2, 8, true)
        put64(v, at + 4, e.offset)
      }
      await this.emit(c)
    }
    const cdSize = this.offset - cdStart
    const count = this.entries.length
    const zip64 = cdStart >= MAX32 || this.offset >= MAX32 || count >= 0xffff
    if (zip64) {
      const recAt = this.offset
      const r = new Uint8Array(56 + 20)
      const v = new DataView(r.buffer)
      v.setUint32(0, SIG_ZIP64_EOCD, true)
      put64(v, 4, 44)
      v.setUint16(12, 45, true)
      v.setUint16(14, 45, true)
      put64(v, 24, count)
      put64(v, 32, count)
      put64(v, 40, cdSize)
      put64(v, 48, cdStart)
      v.setUint32(56, SIG_ZIP64_LOCATOR, true)
      put64(v, 64, recAt)
      v.setUint32(72, 1, true)
      await this.emit(r)
    }
    const end = new Uint8Array(22)
    const v = new DataView(end.buffer)
    v.setUint32(0, SIG_EOCD, true)
    v.setUint16(8, Math.min(count, 0xffff), true)
    v.setUint16(10, Math.min(count, 0xffff), true)
    v.setUint32(12, Math.min(cdSize, MAX32), true)
    v.setUint32(16, zip64 ? MAX32 : cdStart, true)
    await this.emit(end)
    return this.offset
  }
}

export interface ZipEntry { name: string; method: number; crc: number; csize: number; usize: number; offset: number }

/** Reads a ZIP archive held in a Blob, entry by entry, without loading it. */
export class ZipReader {
  private constructor(private readonly blob: Blob, readonly entries: Map<string, ZipEntry>) {}

  static async open(blob: Blob): Promise<ZipReader> {
    const size = blob.size
    if (size < 22) throw new ZipError('not-zip')
    const tailStart = Math.max(0, size - 22 - 65535)
    const tail = await readRange(blob, tailStart, size)
    const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength)
    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === SIG_EOCD) { eocd = i; break }
    if (eocd < 0) throw new ZipError('not-zip')
    let count = tv.getUint16(eocd + 10, true)
    let cdSize = tv.getUint32(eocd + 12, true)
    let cdStart = tv.getUint32(eocd + 16, true)
    if (count === 0xffff || cdSize === MAX32 || cdStart === MAX32) {
      const loc = eocd - 20
      if (loc < 0 || tv.getUint32(loc, true) !== SIG_ZIP64_LOCATOR) throw new ZipError('damaged')
      const recAt = get64(tv, loc + 8)
      const rec = await readRange(blob, recAt, recAt + 56)
      const rv = new DataView(rec.buffer, rec.byteOffset, rec.byteLength)
      if (rec.length < 56 || rv.getUint32(0, true) !== SIG_ZIP64_EOCD) throw new ZipError('damaged')
      count = get64(rv, 32); cdSize = get64(rv, 40); cdStart = get64(rv, 48)
    }
    if (cdStart + cdSize > size || cdSize > 512 * 1024 * 1024 || count > 5_000_000) throw new ZipError('damaged')
    const cd = await readRange(blob, cdStart, cdStart + cdSize)
    const v = new DataView(cd.buffer, cd.byteOffset, cd.byteLength)
    const entries = new Map<string, ZipEntry>()
    let p = 0
    for (let i = 0; i < count; i++) {
      if (p + 46 > cd.length || v.getUint32(p, true) !== SIG_CENTRAL) throw new ZipError('damaged')
      const method = v.getUint16(p + 10, true)
      const crc = v.getUint32(p + 16, true)
      let csize = v.getUint32(p + 20, true)
      let usize = v.getUint32(p + 24, true)
      const nameLen = v.getUint16(p + 28, true)
      const extraLen = v.getUint16(p + 30, true)
      const commentLen = v.getUint16(p + 32, true)
      let offset = v.getUint32(p + 42, true)
      if (p + 46 + nameLen + extraLen + commentLen > cd.length) throw new ZipError('damaged')
      const name = dec.decode(cd.subarray(p + 46, p + 46 + nameLen))
      // ZIP64 extra field: the 8-byte values of the fields set to 0xFFFFFFFF, in this order
      for (let x = p + 46 + nameLen, xEnd = x + extraLen; x + 4 <= xEnd;) {
        const id = v.getUint16(x, true), len = v.getUint16(x + 2, true)
        if (id === 0x0001) {
          let q = x + 4
          if (usize === MAX32) { usize = get64(v, q); q += 8 }
          if (csize === MAX32) { csize = get64(v, q); q += 8 }
          if (offset === MAX32) { offset = get64(v, q) }
        }
        x += 4 + len
      }
      entries.set(name, { name, method, crc, csize, usize, offset })
      p += 46 + nameLen + extraLen + commentLen
    }
    return new ZipReader(blob, entries)
  }

  get(name: string): ZipEntry | undefined { return this.entries.get(name) }

  /** Where an entry's (compressed) bytes start and end in the archive. */
  async dataRange(e: ZipEntry): Promise<[number, number]> {
    const h = await readRange(this.blob, e.offset, e.offset + 30)
    const v = new DataView(h.buffer, h.byteOffset, h.byteLength)
    if (h.length < 30 || v.getUint32(0, true) !== SIG_LOCAL) throw new ZipError('damaged')
    const start = e.offset + 30 + v.getUint16(26, true) + v.getUint16(28, true)
    const end = start + e.csize
    if (end > this.blob.size) throw new ZipError('damaged')
    return [start, end]
  }

  /** A stored entry as a slice of the archive (no copy). */
  async slice(e: ZipEntry, type = ''): Promise<Blob> {
    if (e.method !== 0) throw new ZipError('not-stored')
    const [start, end] = await this.dataRange(e)
    return this.blob.slice(start, end, type)
  }

  /** The whole content of an entry, decompressed and checked against its CRC-32. */
  async read(e: ZipEntry): Promise<Uint8Array> {
    if (e.usize > 256 * 1024 * 1024) throw new ZipError('entry-too-large')
    const [start, end] = await this.dataRange(e)
    const raw = await readRange(this.blob, start, end)
    let out: Uint8Array
    if (e.method === 0) out = raw
    else if (e.method === 8) {
      try { out = inflateSync(raw, { out: new Uint8Array(e.usize) }) } catch { throw new ZipError('damaged') }
    } else throw new ZipError('method')
    if (out.length !== e.usize || crc32(out) !== e.crc) throw new ZipError('damaged')
    return out
  }

  async text(e: ZipEntry): Promise<string> {
    return dec.decode(await this.read(e))
  }
}
