// The backup file, format 2: a ZIP archive (optionally encrypted as a whole, see ./crypto) holding
//   tables/<table>-<n>.json   the rows of each table, in parts of a few MB (a big clinic never makes one huge string)
//   files/<id>/<name>         each patient file (x-ray, photo, PDF) as its original bytes
//   manifest.json             app, format, schema version, export time, row counts, the parts of every table
// Old backups (format 1: one JSON file with files as data: URLs) are still read.
//
// Writing streams table by table and file by file; reading checks every part (CRC-32, row counts, file types)
// and prepares every patient file as a Blob BEFORE anything in the database changes.
import { db, dataUrlToBlob, SCHEMA_VERSION, TABLE_NAMES, type TableName } from '@/db'
import type { BackupFile, PatientFile } from '@/db/types'
import { crc32, readRange } from '@/platform/bytes'
import { safeFileType, SNIFF_BYTES } from '@/platform/filetype'
import { appVersion } from '@/platform'
import { parseBackup, REQUIRED_TABLES, summarizeBackup, type BackupSummary } from '../lib'
import { decryptBackup, DecryptError, encryptingWriter, isEncryptedBackup } from './crypto'
import { ZipReader, ZipWriter, type ZipEntry } from './zip'

export const ARCHIVE_FORMAT = 2
export const BACKUP_EXT = 'dentora'
/** Saved as plain bytes: Android's documents screen then keeps the .dentora name as typed. */
export const BACKUP_MIME = 'application/octet-stream'
/** What the restore pickers accept: new archives and old JSON backups. */
export const BACKUP_ACCEPT = `.${BACKUP_EXT},.zip,.json,application/json,application/zip,application/octet-stream`
const PART_CHARS = 8 * 1024 * 1024
const READ_STEP = 4 * 1024 * 1024

/** dentora-backup-2026-10-11-0930.dentora (local time, so two backups on one day keep both files). */
export function archiveFileName(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `dentora-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${BACKUP_EXT}`
}

export type BackupFailure = 'json' | 'app' | 'tables' | 'newer' | 'password' | 'damaged' | 'read' | 'space'
export class BackupError extends Error {
  constructor(readonly reason: BackupFailure) { super(`backup-${reason}`); this.name = 'BackupError' }
}

export type BackupStage = 'tables' | 'files' | 'decrypt' | 'check'
export interface BackupProgress { stage: BackupStage; done: number; total: number }

interface Manifest {
  app: 'dentora'; format: number; version: number; exportedAt: string; appVersion?: string
  tables: Record<string, { rows: number; parts: string[] }>
  files: { count: number; bytes: number }
}

// ---- writing --------------------------------------------------------------------------------------------------
export interface Snapshot { tables: Record<TableName, Record<string, unknown>[]>; rows: number; files: number; fileBytes: number }

/** Every row of every table, read in one transaction so the backup is consistent. File bytes stay in their Blobs. */
export async function snapshotDatabase(): Promise<Snapshot> {
  const tables = {} as Snapshot['tables']
  await db.transaction('r', TABLE_NAMES.map(n => (db as any)[n]), async () => {
    for (const name of TABLE_NAMES) tables[name] = await (db as any)[name].toArray()
  })
  let rows = 0
  for (const name of TABLE_NAMES) rows += tables[name].length
  const files = (tables.files as unknown as PatientFile[]).filter(f => f.data instanceof Blob)
  return { tables, rows, files: files.length, fileBytes: files.reduce((a, f) => a + f.data.size, 0) }
}

/** A rough size of the finished backup (attachments + compressed rows), for a free-space check before writing. */
export const estimateBackupSize = (s: Snapshot) => s.fileBytes + s.rows * 400 + 64 * 1024

const safePart = (s: string, max: number) => (s || '').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, '_').replace(/^\.+/, '_').slice(0, max) || '_'

export interface WriteOptions {
  password?: string
  signal?: AbortSignal
  onProgress?: (p: BackupProgress) => void
  now?: Date
}

/** Writes the whole backup archive through `out`, in order. Returns what it contains. */
export async function writeBackup(snap: Snapshot, out: (bytes: Uint8Array) => Promise<void>, opts: WriteOptions = {}): Promise<{ rows: number; files: number; fileBytes: number }> {
  const now = opts.now ?? new Date()
  const abort = () => { if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError') }
  const sealed = opts.password ? await encryptingWriter(opts.password, out) : null
  const zip = new ZipWriter(sealed ? b => sealed.write(b) : out, now)
  const enc = new TextEncoder()
  const manifest: Manifest = {
    app: 'dentora', format: ARCHIVE_FORMAT, version: SCHEMA_VERSION, exportedAt: now.toISOString(), appVersion: appVersion(),
    tables: {}, files: { count: 0, bytes: 0 },
  }

  // patient files: each row names its archive entry; the bytes follow after the tables
  const entries: { name: string; blob: Blob }[] = []
  const used = new Set<string>()
  const fileRows = (snap.tables.files as unknown as PatientFile[]).map(f => {
    const { data, ...row } = f
    if (!(data instanceof Blob)) return row
    let name = `files/${safePart(String(f.id), 64)}/${safePart(f.name || 'file', 120)}`
    for (let i = 2; used.has(name); i++) name = `files/${safePart(String(f.id), 64)}-${i}/${safePart(f.name || 'file', 120)}`
    used.add(name)
    entries.push({ name, blob: data })
    return { ...row, __entry: name, __bytes: data.size }
  })

  let rowsDone = 0
  for (const table of TABLE_NAMES) {
    const rows: unknown[] = table === 'files' ? fileRows : snap.tables[table]
    const parts: string[] = []
    let i = 0
    do {
      abort()
      const name = `tables/${table}-${parts.length}.json`
      // one part: rows until it reaches PART_CHARS, encoded in pieces of about 1 MB
      const piece = function* () {
        let text = '[', chars = 0, first = true
        while (i < rows.length && chars < PART_CHARS) {
          const s = JSON.stringify(rows[i++])
          text += (first ? '' : ',') + s
          first = false
          chars += s.length
          if (text.length >= 1024 * 1024) { yield enc.encode(text); text = '' }
        }
        yield enc.encode(text + ']')
      }
      await zip.addDeflated(name, piece())
      parts.push(name)
      opts.onProgress?.({ stage: 'tables', done: rowsDone + i, total: snap.rows })
    } while (i < rows.length)
    rowsDone += rows.length
    manifest.tables[table] = { rows: rows.length, parts }
  }

  let bytesDone = 0
  const total = entries.reduce((a, e) => a + e.blob.size, 0)
  for (const e of entries) {
    abort()
    const blob = e.blob
    await zip.addStored(e.name, (async function* () {
      for (let off = 0; off < blob.size; off += READ_STEP) {
        abort()
        const chunk = await readRange(blob, off, Math.min(blob.size, off + READ_STEP))
        bytesDone += chunk.length
        opts.onProgress?.({ stage: 'files', done: bytesDone, total })
        yield chunk
      }
    })())
    manifest.files.count++
    manifest.files.bytes += blob.size
  }

  await zip.addDeflated('manifest.json', [enc.encode(JSON.stringify(manifest))])
  await zip.finish()
  if (sealed) await sealed.end()
  return { rows: snap.rows, files: manifest.files.count, fileBytes: manifest.files.bytes }
}

// ---- reading --------------------------------------------------------------------------------------------------
export type BackupKind = 'archive' | 'encrypted' | 'json' | 'unknown'

/** What kind of file this is, from its first bytes. */
export async function detectBackup(file: Blob): Promise<BackupKind> {
  if (await isEncryptedBackup(file)) return 'encrypted'
  const head = await readRange(file, 0, 64)
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && (head[2] === 3 || head[2] === 5)) return 'archive'
  let i = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf ? 3 : 0
  while (i < head.length && (head[i] === 0x20 || head[i] === 0x0a || head[i] === 0x0d || head[i] === 0x09)) i++
  return head[i] === 0x7b ? 'json' : 'unknown'
}

export interface BackupInfo {
  format: 1 | 2
  encrypted: boolean
  /** Patient files ready to restore, and their size. */
  files: number
  fileBytes: number
  /** Patient files that could not be read (missing, cut or altered): restored without them. */
  damaged: string[]
}
export interface ReadResult { data: BackupFile; summary: BackupSummary; info: BackupInfo }
export interface ReadOptions { password?: string; onProgress?: (p: BackupProgress) => void; signal?: AbortSignal }

/**
 * Reads and checks a backup file of any format. Everything the restore needs (rows, and every patient file as a
 * Blob with its proven type) is ready when this resolves; nothing in the database has changed.
 */
export async function readBackup(file: Blob, opts: ReadOptions = {}): Promise<ReadResult> {
  let kind: BackupKind
  try { kind = await detectBackup(file) } catch { throw new BackupError('read') }
  if (kind === 'unknown') throw new BackupError(unknownReason(file))
  if (kind === 'json') return readLegacy(file)
  let archive: Blob = file
  if (kind === 'encrypted') {
    if (!opts.password) throw new BackupError('password')
    try {
      archive = await decryptBackup(file, opts.password, (done, total) => opts.onProgress?.({ stage: 'decrypt', done, total }))
    } catch (e) {
      if (e instanceof DecryptError) throw new BackupError(e.reason)
      throw new BackupError('read')
    }
    if ((await detectBackup(archive)) !== 'archive') throw new BackupError('damaged')
  }
  return readArchive(archive, kind === 'encrypted', opts)
}

/** An unreadable file that carries the backup's own name (.dentora) is a damaged backup, not some other file. */
export function unknownReason(file: Blob): BackupFailure {
  const name = (file as Partial<File>).name
  return typeof name === 'string' && name.toLowerCase().endsWith(`.${BACKUP_EXT}`) ? 'damaged' : 'app'
}

const isRow = (r: unknown): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r)
/** Every row is an object with its key (id, or key for settings): what the database needs to store it. */
function rowsValid(table: string, rows: unknown[]): boolean {
  const pk = table === 'settings' ? 'key' : 'id'
  return rows.every(r => isRow(r) && ((typeof r[pk] === 'string' && r[pk] !== '') || (typeof r[pk] === 'number' && Number.isFinite(r[pk]))))
}

async function readArchive(archive: Blob, encrypted: boolean, opts: ReadOptions): Promise<ReadResult> {
  let zip: ZipReader
  try { zip = await ZipReader.open(archive) } catch { throw new BackupError('damaged') }
  const me = zip.get('manifest.json')
  if (!me) throw new BackupError('app')
  let manifest: Manifest
  try { manifest = JSON.parse(await zip.text(me)) } catch { throw new BackupError('damaged') }
  if (!isRow(manifest) || manifest.app !== 'dentora') throw new BackupError('app')
  if (Number(manifest.format) > ARCHIVE_FORMAT || Number(manifest.version) > SCHEMA_VERSION) throw new BackupError('newer')
  if (!isRow(manifest.tables)) throw new BackupError('tables')

  const tables: Record<string, unknown[]> = {}
  for (const name of TABLE_NAMES) {
    const t = manifest.tables[name]
    if (!t) continue
    if (!Array.isArray(t.parts)) throw new BackupError('damaged')
    const rows: unknown[] = []
    for (const part of t.parts) {
      const e = zip.get(String(part))
      if (!e) throw new BackupError('damaged')
      let list: unknown
      try { list = JSON.parse(await zip.text(e)) } catch { throw new BackupError('damaged') }
      if (!Array.isArray(list)) throw new BackupError('damaged')
      for (const r of list) rows.push(r)
    }
    if (rows.length !== Number(t.rows) || !rowsValid(name, rows)) throw new BackupError('damaged')
    tables[name] = rows
  }
  if (REQUIRED_TABLES.some(k => !Array.isArray(tables[k]))) throw new BackupError('tables')

  // patient files: find each one, check its CRC-32 and its real type, and keep it as a slice of the archive
  const fileRows = (tables.files ?? []) as Record<string, unknown>[]
  const entries = fileRows.map(r => (typeof r.__entry === 'string' ? zip.get(r.__entry) : undefined))
  const total = entries.reduce((a, e) => a + (e ? e.csize : 0), 0)
  let done = 0
  const kept: Record<string, unknown>[] = []
  const damaged: string[] = []
  let fileBytes = 0
  for (let i = 0; i < fileRows.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const row = fileRows[i], e = entries[i]
    const label = String(row.name || row.id)
    const blob = e ? await checkedEntry(zip, archive, e, n => opts.onProgress?.({ stage: 'check', done: done + n, total })) : null
    if (e) done += e.csize
    if (!blob) { damaged.push(label); continue }
    kept.push({ ...row, data: blob })
    fileBytes += blob.size
  }
  tables.files = kept

  const data: BackupFile = { app: 'dentora', version: Number(manifest.version) || 1, exportedAt: String(manifest.exportedAt || ''), tables }
  return { data, summary: summarizeBackup(data), info: { format: 2, encrypted, files: kept.length, fileBytes, damaged } }
}

/** A stored entry, read once to check its CRC-32 and its first bytes; null when it does not match. */
async function checkedEntry(zip: ZipReader, archive: Blob, e: ZipEntry, progress: (n: number) => void): Promise<Blob | null> {
  if (e.method !== 0 || e.csize !== e.usize) return null
  let start: number, end: number
  try { [start, end] = await zip.dataRange(e) } catch { return null }
  let crc = 0
  let head: Uint8Array | null = null
  for (let off = start; off < end; off += READ_STEP) {
    const chunk = await readRange(archive, off, Math.min(end, off + READ_STEP))
    if (!head) head = chunk.subarray(0, SNIFF_BYTES)
    crc = crc32(chunk, crc)
    progress(Math.min(end, off + READ_STEP) - start)
  }
  if (crc !== e.crc) return null
  return archive.slice(start, end, safeFileType(head ?? new Uint8Array(0)))
}

/** Format 1: one JSON file, patient files as data: URLs. */
async function readLegacy(file: Blob): Promise<ReadResult> {
  let text: string
  try { text = await file.text() } catch { throw new BackupError('read') }
  const r = parseBackup(text, SCHEMA_VERSION)
  text = ''
  if (!r.ok) throw new BackupError(r.reason)
  const data = r.data
  for (const name of TABLE_NAMES) {
    const rows = data.tables[name]
    if (rows !== undefined && !rowsValid(name, rows)) throw new BackupError('damaged')
  }
  const damaged: string[] = []
  let fileBytes = 0
  const files = Array.isArray(data.tables.files) ? data.tables.files : []
  const kept: unknown[] = []
  for (const raw of files) {
    if (!isRow(raw)) continue
    const blob = typeof raw.data === 'string' ? dataUrlToBlob(raw.data) : null
    if (!blob) { damaged.push(String(raw.name || raw.id || '')); continue }
    kept.push({ ...raw, data: blob })
    fileBytes += blob.size
  }
  data.tables.files = kept
  return { data, summary: summarizeBackup(data), info: { format: 1, encrypted: false, files: kept.length, fileBytes, damaged } }
}
