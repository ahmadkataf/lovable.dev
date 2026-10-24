// Cloud backups — the yearly add-on. The whole database (lib/backup) is gzipped and sent to the license
// server, which keeps the newest few snapshots per license; any device of that license can restore them.
// Needs an active lifetime license with cloudUntil in the future (license.credentials()).
import { db } from '../db'
import { license } from '../license'
import { cloudActive, type LicenseStatus } from '../license/types'
import { errorMessageKey } from '../license/crypto'
import { exportBackup, importBackup, validateBackup, markBackupDone, type BackupCounts } from './backup'
import { platform } from './platform'
import { useStore } from '../state/store'
import { logError } from './recovery'

export const CLOUD_LAST_KEY = 'cloud.last'
export const CLOUD_EVERY = 24 * 3600000       // one automatic upload a day
const START_DELAY = 90 * 1000                  // after launch, once the app has settled
const TICK = 30 * 60000
const FETCH_TIMEOUT = 120000

export interface CloudSnapshot {
  id: string
  at: number
  size: number
  device: string          // the short device code that uploaded it
  counts?: Partial<BackupCounts>
  appVersion?: string
  exportedAt?: number
  name?: string
}
export type CloudResult<T> = { ok: true } & T | { ok: false; error: string; errorText?: string }
export type CloudState = 'demo' | 'unlicensed' | 'none' | 'active' | 'expired'

/** What the backup page should show for this license. */
export function cloudState(s: LicenseStatus, now = Date.now()): CloudState {
  if (s.state === 'demo') return 'demo'
  if (s.state !== 'active') return 'unlicensed'
  if (cloudActive(s, now)) return 'active'
  return typeof s.cloudUntil === 'number' ? 'expired' : 'none'
}

// ---------- gzip (CompressionStream exists in every Chromium the app runs in, and in Node 18+) ----------
async function pump(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  const parts: Uint8Array[] = []
  const reader = stream.getReader()
  let total = 0
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); total += value.length }
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
export async function gzipText(text: string): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof CompressionStream === 'undefined') throw Object.assign(new Error('CompressionStream is not available (update Android System WebView)'), { name: 'NotSupportedError' })
  const cs = new CompressionStream('gzip')
  const w = cs.writable.getWriter()
  void w.write(new TextEncoder().encode(text)).then(() => w.close())
  return pump(cs.readable as ReadableStream<Uint8Array>)
}
export async function gunzipText(bytes: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('gzip')
  const w = ds.writable.getWriter()
  void w.write(new Uint8Array(bytes)).then(() => w.close())
  return new TextDecoder().decode(await pump(ds.readable as ReadableStream<Uint8Array>))
}

// ---------- the last upload ----------
export async function getLastCloudBackup(): Promise<number | null> {
  const row = await db.kv.get(CLOUD_LAST_KEY)
  const v = row?.value
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
/** The daily upload is due when the plan is active, the switch is on, and the last one is older than a day. */
export function shouldAutoBackup(last: number | null, active: boolean, enabled: boolean, now = Date.now()): boolean {
  if (!active || !enabled) return false
  return !last || now - last >= CLOUD_EVERY
}

// ---------- network ----------
const STALL_TIMEOUT = 45000      // a body that stops arriving for this long is given up (a moving one never is)
type Reply<T> = { ok: true; data: T } | { ok: false; error: string; errorText?: string }
/** One call to the cloud API, the response body included. Before, the time limit stopped at the response headers and
 *  a body that stalled on a weak line kept "Backup now" / "Restore" spinning for good. Now the limit covers the whole
 *  exchange: `timeout` for the request and the first byte, then `STALL_TIMEOUT` of silence while the body arrives. */
async function request<T>(path: string, init: RequestInit, kind: 'json' | 'bytes', timeout = FETCH_TIMEOUT, onBytes?: (received: number) => void): Promise<Reply<T>> {
  const ctl = new AbortController()
  let timer = setTimeout(() => ctl.abort(), timeout)
  const progress = () => { clearTimeout(timer); timer = setTimeout(() => ctl.abort(), STALL_TIMEOUT) }
  try {
    const res = await fetch(license.api() + path, { ...init, signal: ctl.signal, cache: 'no-store' })
    progress()
    if (!res.ok) {
      let d: { error?: unknown; message?: unknown } = {}
      try { d = await res.json() } catch { /* not json */ }
      return { ok: false, error: typeof d.error === 'string' ? d.error : res.status >= 500 ? 'network' : 'unknown', errorText: typeof d.message === 'string' ? d.message : undefined }
    }
    let out: Uint8Array
    if (!res.body) out = new Uint8Array(await res.arrayBuffer())
    else {
      const reader = res.body.getReader()
      const parts: Uint8Array[] = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        parts.push(value); total += value.length; progress()
        try { onBytes?.(total) } catch { /* the display must not break the download */ }
      }
      out = new Uint8Array(total)
      let o = 0
      for (const p of parts) { out.set(p, o); o += p.length }
    }
    if (kind === 'bytes') return { ok: true, data: out as T }
    // an answer that is not the server's JSON (cut off, or a Wi-Fi login page) is a failed request, never "nothing there"
    try { return { ok: true, data: JSON.parse(new TextDecoder().decode(out)) as T } } catch { return { ok: false, error: 'network' } }
  } catch { return { ok: false, error: 'network' } }
  finally { clearTimeout(timer) }
}
/** JSON with every non-ASCII character escaped (\\uXXXX): header values must be Latin-1, and the server's
 *  JSON.parse reads the escapes back (an Arabic computer name used to make every upload fail). */
export const asciiJson = (v: unknown): string => JSON.stringify(v).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
const fail = (error: string, errorText?: string): { ok: false; error: string; errorText?: string } => ({ ok: false, error: errorMessageKey(error), errorText })

let uploading: Promise<CloudResult<{ at: number; size: number }>> | null = null

/** Exports, compresses and uploads the database. One upload at a time. */
export function uploadBackup(): Promise<CloudResult<{ at: number; size: number }>> {
  if (uploading) return uploading
  uploading = (async (): Promise<CloudResult<{ at: number; size: number }>> => {
    const cred = license.credentials()
    if (!cred) return fail('cloud_inactive')
    if (!cloudActive(license.get())) return fail('cloud_inactive')
    let json: string, bytes: Uint8Array<ArrayBuffer>
    let v: ReturnType<typeof validateBackup>
    try {
      json = await exportBackup()
      v = validateBackup(json)
      bytes = await gzipText(json)
    } catch (e) {
      logError('cloud-upload', e)
      return (e as { name?: string } | null)?.name === 'NotSupportedError' ? { ok: false, error: 'settings.cloud.err.webviewOld' } : fail('unknown')
    }
    const meta = { counts: v.counts, appVersion: v.appVersion, exportedAt: v.exportedAt, name: await platform.deviceName().catch(() => '') }
    // the upload itself has no progress events: allow ~20 KB/s on top of the usual limit for a big file
    const r = await request<{ at?: number; size?: number }>('/api/backup', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'x-kaseb-token': cred.token, 'x-kaseb-device': cred.device, 'x-kaseb-meta': asciiJson(meta) },
      body: bytes,
    }, 'json', FETCH_TIMEOUT + Math.round(bytes.length / 20))
    if (!r.ok) return fail(r.error, r.errorText)
    const data = r.data
    // only the server's answer counts (a Wi-Fi login page answering 200 is not a backup)
    if (typeof data.at !== 'number') return fail('network')
    const at = data.at
    await db.kv.put({ key: CLOUD_LAST_KEY, value: at })
    await markBackupDone(at)
    return { ok: true, at, size: typeof data.size === 'number' ? data.size : bytes.length }
  })().finally(() => { uploading = null })
  return uploading
}

/** The snapshots stored for this license (from every device of it). */
export async function listBackups(): Promise<CloudResult<{ backups: CloudSnapshot[]; cloudUntil: number | null }>> {
  const cred = license.credentials()
  if (!cred) return fail('cloud_inactive')
  const r = await request<{ backups?: CloudSnapshot[]; cloudUntil?: number | null }>('/api/backups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cred) }, 'json')
  if (!r.ok) return fail(r.error, r.errorText)
  const data = r.data
  if (!data || !Array.isArray(data.backups)) return fail('network')
  return { ok: true, backups: data.backups, cloudUntil: typeof data.cloudUntil === 'number' ? data.cloudUntil : null }
}

/** Where a cloud restore is: downloading (bytes so far) or writing the rows into the database. */
export type RestoreProgress = { phase: 'download'; bytes: number } | { phase: 'import'; done: number; total: number }

/** Downloads a snapshot and REPLACES everything in the local database with it. */
export async function restoreBackup(id: string, onProgress?: (p: RestoreProgress) => void): Promise<CloudResult<{ counts: BackupCounts }>> {
  const cred = license.credentials()
  if (!cred) return fail('cloud_inactive')
  const r = await request<Uint8Array>('/api/backup/get', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...cred, id }) }, 'bytes', FETCH_TIMEOUT,
    bytes => onProgress?.({ phase: 'download', bytes }))
  if (!r.ok) return fail(r.error, r.errorText)
  const bytes = r.data
  let json: string
  try { json = await gunzipText(bytes) } catch { return fail('unknown') }
  const v = validateBackup(json)
  if (!v.ok) return fail('unknown', v.error)
  try { return { ok: true, counts: await importBackup(json, (done, total) => onProgress?.({ phase: 'import', done, total })) } }
  catch (e) {
    logError('cloud-restore', e)
    const n = `${(e as { name?: string } | null)?.name ?? ''} ${(e as { inner?: { name?: string } } | null)?.inner?.name ?? ''}`
    return /Quota/.test(n) ? { ok: false, error: 'settings.cloud.err.storageFull' } : fail('unknown')
  }
}

// ---------- the daily upload ----------
let scheduled = false
export function startCloudScheduler(): void {
  if (scheduled || typeof window === 'undefined') return
  scheduled = true
  const tick = async (): Promise<void> => {
    try {
      const st = useStore.getState()
      if (!st.ready || !st.settings.pos.cloudAuto) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      if (!cloudActive(license.get())) return
      if (!shouldAutoBackup(await getLastCloudBackup(), true, true)) return
      const r = await uploadBackup()
      if (r.ok) st.toast(`☁️ ${new Date(r.at).toLocaleTimeString()}`, 'info')
    } catch { /* next tick */ }
  }
  window.setTimeout(() => void tick(), START_DELAY)
  window.setInterval(() => void tick(), TICK)
  window.addEventListener('online', () => { window.setTimeout(() => void tick(), 5000) })
}
