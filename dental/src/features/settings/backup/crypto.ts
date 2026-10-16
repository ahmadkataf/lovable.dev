// Password protection for backups: AES-256-GCM with a key from PBKDF2-SHA-256, both from the browser (WebCrypto).
// The archive is encrypted in segments of 1 MB so a backup of any size streams through in both directions. Each
// segment has its own nonce (random prefix + counter + "last segment" flag) and authenticates the header, so a
// segment cannot be changed, moved, dropped or cut off without the restore noticing.
//
// File layout:  "DENTORA-ENC1\n" · u16 header length · header JSON · segments (ciphertext + 16-byte tag)
import { BlobBuilder, readRange } from '@/platform/bytes'

export const ENC_MAGIC = 'DENTORA-ENC1\n'
const MAGIC_BYTES = new TextEncoder().encode(ENC_MAGIC)
export const PBKDF2_ITERATIONS = 600_000
const SEGMENT = 1024 * 1024
const TAG = 16
/** Shortest password the export accepts. */
export const MIN_PASSWORD = 8

interface EncHeader { v: 1; kdf: 'PBKDF2-SHA256'; iter: number; salt: string; cipher: 'AES-256-GCM'; seg: number; nonce: string }

export class DecryptError extends Error {
  constructor(readonly reason: 'password' | 'damaged') { super(`decrypt-${reason}`); this.name = 'DecryptError' }
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function deriveKey(password: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

function nonceFor(prefix: Uint8Array, index: number, last: boolean): Uint8Array {
  const n = new Uint8Array(12)
  n.set(prefix, 0)
  new DataView(n.buffer).setUint32(7, index, false)
  n[11] = last ? 1 : 0
  return n
}

/** True when the file starts like an encrypted Dentora backup. */
export async function isEncryptedBackup(file: Blob): Promise<boolean> {
  const head = await readRange(file, 0, MAGIC_BYTES.length)
  return head.length === MAGIC_BYTES.length && head.every((b, i) => b === MAGIC_BYTES[i])
}

/**
 * Wraps `out` so everything written through it is encrypted with `password`. Call end() once after the last write.
 */
export async function encryptingWriter(password: string, out: (bytes: Uint8Array) => Promise<void>, iterations = PBKDF2_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prefix = crypto.getRandomValues(new Uint8Array(7))
  const key = await deriveKey(password, salt, iterations)
  const header: EncHeader = { v: 1, kdf: 'PBKDF2-SHA256', iter: iterations, salt: b64(salt), cipher: 'AES-256-GCM', seg: SEGMENT, nonce: b64(prefix) }
  const json = new TextEncoder().encode(JSON.stringify(header))
  const head = new Uint8Array(MAGIC_BYTES.length + 2 + json.length)
  head.set(MAGIC_BYTES, 0)
  new DataView(head.buffer).setUint16(MAGIC_BYTES.length, json.length, false)
  head.set(json, MAGIC_BYTES.length + 2)
  await out(head)

  const buf = new Uint8Array(SEGMENT)
  let used = 0, index = 0, ended = false
  const seal = async (last: boolean) => {
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceFor(prefix, index, last) as BufferSource, additionalData: head as BufferSource, tagLength: 128 }, key, buf.subarray(0, used))
    index++; used = 0
    await out(new Uint8Array(ct))
  }
  return {
    async write(bytes: Uint8Array): Promise<void> {
      let off = 0
      while (off < bytes.length) {
        // a full segment is sealed only once more data follows, so the last one is always marked as last
        if (used === SEGMENT) await seal(false)
        const n = Math.min(SEGMENT - used, bytes.length - off)
        buf.set(bytes.subarray(off, off + n), used)
        used += n; off += n
      }
    },
    async end(): Promise<void> {
      if (ended) return
      ended = true
      await seal(true)
    },
  }
}

/**
 * Decrypts an encrypted backup into a Blob (built in parts, so the browser can keep it on disk rather than in the
 * page's memory). Throws DecryptError('password') for a wrong password, ('damaged') for a cut or altered file.
 */
export async function decryptBackup(file: Blob, password: string, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const start = await readRange(file, 0, MAGIC_BYTES.length + 2)
  if (start.length < MAGIC_BYTES.length + 2 || !MAGIC_BYTES.every((b, i) => start[i] === b)) throw new DecryptError('damaged')
  const len = new DataView(start.buffer, start.byteOffset).getUint16(MAGIC_BYTES.length, false)
  const head = await readRange(file, 0, MAGIC_BYTES.length + 2 + len)
  let header: EncHeader
  try { header = JSON.parse(new TextDecoder().decode(head.subarray(MAGIC_BYTES.length + 2))) } catch { throw new DecryptError('damaged') }
  if (header?.v !== 1 || header.kdf !== 'PBKDF2-SHA256' || header.cipher !== 'AES-256-GCM') throw new DecryptError('damaged')
  if (!(header.iter >= 100_000 && header.iter <= 10_000_000) || !(header.seg >= 64 * 1024 && header.seg <= 16 * 1024 * 1024)) throw new DecryptError('damaged')
  let salt: Uint8Array, prefix: Uint8Array
  try { salt = unb64(header.salt); prefix = unb64(header.nonce) } catch { throw new DecryptError('damaged') }
  if (salt.length < 8 || prefix.length !== 7) throw new DecryptError('damaged')
  const key = await deriveKey(password, salt, header.iter)

  const bodyStart = head.length
  const body = file.size - bodyStart
  const segLen = header.seg + TAG
  const count = Math.ceil(body / segLen)
  if (count < 1) throw new DecryptError('damaged')
  const out = new BlobBuilder()
  for (let i = 0; i < count; i++) {
    const from = bodyStart + i * segLen
    const to = Math.min(file.size, from + segLen)
    if (to - from < TAG) throw new DecryptError('damaged')
    const ct = await readRange(file, from, to)
    let pt: ArrayBuffer
    try {
      pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonceFor(prefix, i, i === count - 1) as BufferSource, additionalData: head as BufferSource, tagLength: 128 }, key, ct as BufferSource)
    } catch {
      // the first segment fails only for a wrong password (or a file damaged right at the start)
      throw new DecryptError(i === 0 ? 'password' : 'damaged')
    }
    out.push(new Uint8Array(pt))
    onProgress?.(to, file.size)
  }
  return out.build()
}
