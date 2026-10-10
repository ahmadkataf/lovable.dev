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
async function request(path: string, init: RequestInit): Promise<{ res: Response | null; error?: string; errorText?: string }> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(license.api() + path, { ...init, signal: ctl.signal, cache: 'no-store' })
    if (res.ok) return { res }
    let d: { error?: unknown; message?: unknown } = {}
    try { d = await res.json() } catch { /* not json */ }
    return { res: null, error: typeof d.error === 'string' ? d.error : res.status >= 500 ? 'network' : 'unknown', errorText: typeof d.message === 'string' ? d.message : undefined }
  } catch { return { res: null, error: 'network' } }
  finally { clearTimeout(timer) }
}
const fail = (error: string, errorText?: string): { ok: false; error: string; errorText?: string } => ({ ok: false, error: errorMessageKey(error), errorText })

let uploading: Promise<CloudResult<{ at: number; size: number }>> | null = null

/** Exports, compresses and uploads the database. One upload at a time. */
export function uploadBackup(): Promise<CloudResult<{ at: number; size: number }>> {
  if (uploading) return uploading
  uploading = (async (): Promise<CloudResult<{ at: number; size: number }>> => {
    const cred = license.credentials()
    if (!cred) return fail('cloud_inactive')
    if (!cloudActive(license.get())) return fail('cloud_inactive')
    const json = await exportBackup()
    const v = validateBackup(json)
    const bytes = await gzipText(json)
    const meta = { counts: v.counts, appVersion: v.appVersion, exportedAt: v.exportedAt, name: await platform.deviceName().catch(() => '') }
    const { res, error, errorText } = await request('/api/backup', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'x-kaseb-token': cred.token, 'x-kaseb-device': cred.device, 'x-kaseb-meta': JSON.stringify(meta) },
      body: bytes,
    })
    if (!res) return fail(error ?? 'unknown', errorText)
    const data = (await res.json().catch(() => ({}))) as { at?: number; size?: number }
    const at = typeof data.at === 'number' ? data.at : Date.now()
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
  const { res, error, errorText } = await request('/api/backups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cred) })
  if (!res) return fail(error ?? 'unknown', errorText)
  const data = (await res.json().catch(() => ({}))) as { backups?: CloudSnapshot[]; cloudUntil?: number | null }
  return { ok: true, backups: Array.isArray(data.backups) ? data.backups : [], cloudUntil: typeof data.cloudUntil === 'number' ? data.cloudUntil : null }
}

/** Downloads a snapshot and REPLACES everything in the local database with it. */
export async function restoreBackup(id: string): Promise<CloudResult<{ counts: BackupCounts }>> {
  const cred = license.credentials()
  if (!cred) return fail('cloud_inactive')
  const { res, error, errorText } = await request('/api/backup/get', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...cred, id }) })
  if (!res) return fail(error ?? 'unknown', errorText)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let json: string
  try { json = await gunzipText(bytes) } catch { return fail('unknown') }
  const v = validateBackup(json)
  if (!v.ok) return fail('unknown', v.error)
  const counts = await importBackup(json)
  return { ok: true, counts }
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
