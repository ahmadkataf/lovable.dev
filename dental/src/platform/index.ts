// What the web app asks of the device it runs on. Three hosts share the same code:
//   browser  — downloads and <input type=file>
//   Electron — window.dentora (preload bridge): native save/open dialogs, machine id, print
//   Android  — window.DentoraAndroid (JavascriptInterface): saving through the system "save as" screen, print,
//              deviceId; file picking goes through the WebView's file chooser, so <input type=file> keeps working.
//
// Files of any size (a backup can hold gigabytes of x-rays) move in chunks: no file is ever turned into one base64
// string or sent through IPC or the Android bridge in one piece. Every save is checked: the Windows and Android
// shells read the written file back and compare its size and CRC-32 with what the page sent.
import { BlobBuilder, ChunkBuffer, crc32, toBase64 } from './bytes'
import { closeTopLayer } from '@/ui/Overlay'

export type Platform = 'web' | 'electron' | 'android'

/** Why a save failed: no room on the disk, another save still running, the written file did not match, a write error, or stopped. */
export type SaveFailure = 'space' | 'busy' | 'verify' | 'io' | 'aborted'
export type ShellResult = { ok: true; name?: string } | { ok: false; reason: string; detail?: string }

interface ElectronBridge {
  platform: 'electron'
  deviceId(): Promise<string>
  /** Shows the save dialog; null when cancelled, { error } when the chosen place cannot be written.
   *  `quiet`: the page reports failures itself (no native error box). */
  saveBegin(name: string, mime: string, quiet: boolean): Promise<{ id: string; name: string } | { error: string } | null>
  saveChunk(id: string, bytes: Uint8Array): Promise<ShellResult>
  /** Flushes, reads the file back, checks size + CRC-32, then moves it into place. */
  saveEnd(id: string, size: number, crc: number): Promise<ShellResult>
  saveAbort(id: string): Promise<void>
  openBegin(accept: string): Promise<{ id: string; name: string; mime: string; size: number } | null>
  /** Bytes [offset, offset + length) of the opened file; an empty array past the end. Rejects when the file cannot be read. */
  openChunk(id: string, offset: number, length: number): Promise<Uint8Array>
  openEnd(id: string): Promise<void>
  print(): Promise<void>
  appVersion(): Promise<string>
  openExternal(url: string): Promise<void>
}
interface AndroidBridge {
  deviceId(): string
  /** Starts a save into the app's cache folder. Answers JSON: {"id":"…"} or {"error":"busy"|"space"|"io"}. */
  saveBegin(name: string, mime: string, sizeHint: string, quiet: string): string
  /** Appends a base64 piece. Answers '' or an error code. */
  saveChunk(id: string, base64: string): string
  /** Checks size + CRC-32 and opens the "save as" screen. Answers '' (the screen is open) or an error code.
   *  How it ends arrives as the window event 'dentora:saved' { id, ok, cancelled, name, reason }. */
  saveEnd(id: string, size: string, crc: string): string
  saveAbort(id: string): void
  /** Prints the page; `jobName` names the job, which "Save as PDF" offers as the file name. */
  print(jobName?: string): void
  appVersion(): string
  openExternal(url: string): void
}
declare global {
  interface Window { dentora?: ElectronBridge; DentoraAndroid?: AndroidBridge; __dentoraBack?: () => boolean }
  const __APP_VERSION__: string
}

export function platform(): Platform {
  if (typeof window === 'undefined') return 'web'
  if (window.dentora?.platform === 'electron') return 'electron'
  if (window.DentoraAndroid) return 'android'
  return 'web'
}
export const isElectron = () => platform() === 'electron'
export const isAndroid = () => platform() === 'android'
export const isTouch = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || isAndroid())

// ---- version --------------------------------------------------------------------------------------------------
let shellVersion = ''
if (typeof window !== 'undefined' && window.dentora?.platform === 'electron') {
  window.dentora.appVersion().then(v => { if (typeof v === 'string' && v) shellVersion = v }, () => { /* keep the built-in one */ })
}
/**
 * The version the clinic sees. The shells know the version they were released as (a tagged Android build may be newer
 * than package.json was when the web app was built), so their answer wins over the one baked into the bundle.
 */
export function appVersion(): string {
  if (!shellVersion && typeof window !== 'undefined' && window.DentoraAndroid) {
    try { const v = window.DentoraAndroid.appVersion(); if (typeof v === 'string' && v) shellVersion = v } catch { /* older shell */ }
  }
  if (shellVersion) return shellVersion
  try { return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1.0.0' } catch { return '1.0.0' }
}

// ---- saving ---------------------------------------------------------------------------------------------------
export class SaveError extends Error {
  constructor(readonly reason: SaveFailure, readonly detail = '') { super(`save-${reason}${detail ? `: ${detail}` : ''}`); this.name = 'SaveError' }
}
const FAILURES: readonly string[] = ['space', 'busy', 'verify', 'io', 'aborted']
const asFailure = (r: unknown): SaveFailure => (FAILURES.includes(String(r)) ? (String(r) as SaveFailure) : 'io')
function toSaveError(e: unknown): SaveError {
  if (e instanceof SaveError) return e
  if ((e as Error)?.name === 'AbortError') return new SaveError('aborted')
  return new SaveError('io', String((e as Error)?.message || e || ''))
}

export type SaveResult = { status: 'saved'; name: string; bytes: number } | { status: 'cancelled' }
/** Receives the file's bytes, in order. A chunk handed to it belongs to the save afterwards: do not change it. */
export type ChunkWriter = (chunk: Uint8Array) => Promise<void>
export interface SaveStreamOptions {
  /** Expected size in bytes (Android checks the free space before writing). */
  sizeHint?: number
  signal?: AbortSignal
  /** The page explains failures itself, so the shells show no error of their own. */
  quiet?: boolean
  /** All bytes are written; the file now goes to its place (on Android the "save as" screen opens now). */
  onFinishing?: () => void
}

// One save at a time on every platform: a double tap must not open two save screens (the Android shell keeps one
// pending file), and a second export waits for the first instead of overwriting it.
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job)
  queue = run.catch(() => undefined)
  return run
}

/**
 * Writes a file the user keeps (a backup, a CSV, a patient's x-ray) through the platform's own save path, in chunks.
 * `produce` calls `write` with the bytes in order. Resolves 'saved' only once the platform confirms the whole file is
 * there; 'cancelled' when the user closed the save dialog. Throws SaveError when the file could not be written.
 */
export function saveStream(name: string, mime: string, produce: (write: ChunkWriter) => Promise<void>, opts: SaveStreamOptions = {}): Promise<SaveResult> {
  return enqueue(async () => {
    const p = platform()
    try {
      if (p === 'electron' && window.dentora) return await saveElectron(window.dentora, name, mime, produce, opts)
      if (p === 'android' && window.DentoraAndroid) return await saveAndroid(window.DentoraAndroid, name, mime, produce, opts)
      return await saveBrowser(name, mime, produce, opts)
    } catch (e) { throw toSaveError(e) }
  })
}

const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw new SaveError('aborted') }

async function saveBrowser(name: string, mime: string, produce: (write: ChunkWriter) => Promise<void>, opts: SaveStreamOptions): Promise<SaveResult> {
  const out = new BlobBuilder()
  await produce(async chunk => { checkAbort(opts.signal); out.push(chunk) })
  checkAbort(opts.signal)
  opts.onFinishing?.()
  const size = out.size
  const blob = out.build(mime)
  if (blob.size !== size) throw new SaveError('verify')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.style.display = 'none'
  document.body.appendChild(a); a.click()
  // a large file is read by the download after click() returns: keep the URL alive for a while
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, Math.max(4000, Math.min(600_000, size / 50_000)))
  return { status: 'saved', name, bytes: size }
}

async function saveElectron(d: ElectronBridge, name: string, mime: string, produce: (write: ChunkWriter) => Promise<void>, opts: SaveStreamOptions): Promise<SaveResult> {
  const begun = await d.saveBegin(name, mime, !!opts.quiet)
  if (!begun) return { status: 'cancelled' }
  if ('error' in begun) throw new SaveError(asFailure(begun.error))
  const h = begun
  let size = 0, crc = 0
  const out = new ChunkBuffer(4 * 1024 * 1024, async chunk => {
    checkAbort(opts.signal)
    const r = await d.saveChunk(h.id, chunk)
    if (!r.ok) throw new SaveError(asFailure(r.reason), r.detail)
  })
  try {
    await produce(async chunk => { checkAbort(opts.signal); crc = crc32(chunk, crc); size += chunk.length; await out.write(chunk) })
    await out.end()
    checkAbort(opts.signal)
    opts.onFinishing?.()
    const r = await d.saveEnd(h.id, size, crc)
    if (!r.ok) throw new SaveError(asFailure(r.reason), r.detail)
    return { status: 'saved', name: r.name || h.name || name, bytes: size }
  } catch (e) {
    try { await d.saveAbort(h.id) } catch { /* already closed */ }
    throw e
  }
}

interface SavedDetail { id?: string; ok?: boolean; cancelled?: boolean; name?: string; reason?: string }

async function saveAndroid(a: AndroidBridge, name: string, mime: string, produce: (write: ChunkWriter) => Promise<void>, opts: SaveStreamOptions): Promise<SaveResult> {
  let begin: { id?: string; error?: string } = {}
  try { begin = JSON.parse(a.saveBegin(name, mime, String(Math.max(0, Math.round(opts.sizeHint ?? 0))), opts.quiet ? '1' : '')) } catch { begin = { error: 'io' } }
  if (!begin.id) throw new SaveError(asFailure(begin.error))
  const id = begin.id
  let size = 0, crc = 0, handedOver = false
  // the bridge takes strings: 768 KB of bytes is a 1 MB base64 piece, small for the Java heap
  const out = new ChunkBuffer(768 * 1024, async chunk => {
    checkAbort(opts.signal)
    const err = a.saveChunk(id, toBase64(chunk))
    if (err) throw new SaveError(asFailure(err))
    await new Promise<void>(r => setTimeout(r, 0))   // let the page breathe between bridge calls
  })
  try {
    await produce(async chunk => { checkAbort(opts.signal); crc = crc32(chunk, crc); size += chunk.length; await out.write(chunk) })
    await out.end()
    checkAbort(opts.signal)
    opts.onFinishing?.()
    const ended = waitForSaved(id)
    const err = a.saveEnd(id, String(size), String(crc >>> 0))
    if (err) { ended.cancel(); throw new SaveError(asFailure(err)) }
    handedOver = true
    const r = await ended.promise
    if (r.cancelled) return { status: 'cancelled' }
    if (!r.ok) throw new SaveError(asFailure(r.reason))
    return { status: 'saved', name: r.name || name, bytes: size }
  } catch (e) {
    if (!handedOver) { try { a.saveAbort(id) } catch { /* gone */ } }
    throw e
  }
}

/** The Android shell reports the end of a save (after the "save as" screen and the copy) with a window event. */
function waitForSaved(id: string): { promise: Promise<SavedDetail>; cancel: () => void } {
  let stop = () => { /* set below */ }
  const promise = new Promise<SavedDetail>(resolve => {
    const on = (e: Event) => {
      const d = ((e as CustomEvent).detail || {}) as SavedDetail
      if (d.id !== id) return       // another save's answer (a data: download the shell saved by itself)
      stop(); resolve(d)
    }
    stop = () => window.removeEventListener('dentora:saved', on)
    window.addEventListener('dentora:saved', on)
  })
  return { promise, cancel: () => stop() }
}

// A double tap on the same export is ignored while that save runs (resolving false, so the page shows no second
// "saved" message); a different file waits in the queue for its turn.
const running = new Set<string>()

/** Saves a file where the user can find it (Downloads, or a save dialog). Resolves false when cancelled, failed, or
 *  when the same file is already being saved. */
export function saveFile(name: string, blob: Blob): Promise<boolean> {
  const key = `${name}\u0000${blob.size}\u0000${blob.type}`
  if (running.has(key)) return Promise.resolve(false)
  const job = saveStream(name, blob.type || 'application/octet-stream', async write => {
    for (let off = 0; off < blob.size; off += 4 * 1024 * 1024) {
      await write(new Uint8Array(await blob.slice(off, Math.min(blob.size, off + 4 * 1024 * 1024)).arrayBuffer()))
    }
  }, { sizeHint: blob.size }).then(r => r.status === 'saved', () => false).finally(() => running.delete(key))
  running.add(key)
  return job
}
export async function saveText(name: string, text: string, mime = 'application/json'): Promise<boolean> {
  return saveFile(name, new Blob([text], { type: mime }))
}

// The Android shell hands blob: downloads (an <a download> click it intercepted) back to the page.
if (typeof window !== 'undefined' && window.DentoraAndroid) {
  ;(window as unknown as { __dentoraSaveBlob?: (url: string, name: string) => void }).__dentoraSaveBlob = (url, name) => {
    void fetch(url).then(r => r.blob()).then(b => saveFile(name, b)).catch(() => undefined)
  }
}

// ---- picking --------------------------------------------------------------------------------------------------
/** Lets the user pick one file. Resolves null when cancelled (or, on Windows, when the file could not be read). */
export async function pickFile(accept = '*/*'): Promise<File | null> {
  if (platform() === 'electron' && window.dentora) return pickElectron(window.dentora, accept)
  return new Promise(res => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = accept; input.style.display = 'none'
    let done = false
    const cleanup = () => {
      window.removeEventListener('dentora:pick-cancelled', onShellCancel)
      window.removeEventListener('focus', onFocus)
      setTimeout(() => input.remove(), 0)
    }
    const finish = (f: File | null) => { if (done) return; done = true; cleanup(); res(f) }
    input.onchange = () => finish(input.files?.[0] ?? null)
    input.addEventListener('cancel', () => finish(null))        // Chromium 113+, Firefox, Safari 16.4+, Android WebView 113+
    // the Android shell says so when its picker closed without a file
    const onShellCancel = () => finish(null)
    window.addEventListener('dentora:pick-cancelled', onShellCancel)
    // Browsers without the 'cancel' event: the window regains focus when the dialog closes. A chosen file can reach the
    // input well after that (slow drives, cloud folders), so keep watching for a few seconds before giving up.
    const onFocus = () => {
      window.removeEventListener('focus', onFocus)
      let waited = 0
      const tick = () => {
        if (done) return
        if (input.files?.length) { finish(input.files[0]); return }
        waited += 250
        if (waited >= 5000) { finish(null); return }
        setTimeout(tick, 250)
      }
      setTimeout(tick, 250)
    }
    if (!isAndroid()) window.addEventListener('focus', onFocus)
    document.body.appendChild(input); input.click()
  })
}

async function pickElectron(d: ElectronBridge, accept: string): Promise<File | null> {
  const h = await d.openBegin(accept)
  if (!h) return null
  try {
    const out = new BlobBuilder()
    while (out.size < h.size) {
      const chunk = await d.openChunk(h.id, out.size, 8 * 1024 * 1024)
      if (!chunk || !chunk.length) break
      out.push(chunk)
    }
    if (out.size !== h.size) return null
    return new File([out.build(h.mime)], h.name, { type: h.mime })
  } catch {
    return null      // the shell has already told the user the file could not be read
  } finally {
    try { await d.openEnd(h.id) } catch { /* closed */ }
  }
}

// ---- printing -------------------------------------------------------------------------------------------------
/** A print job name the system accepts as a file name ("Save as PDF" suggests it): no path characters, one line. */
export function printJobName(name?: string): string {
  return (name || '').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}
let titleBeforePrint: string | null = null
/**
 * Prints the current screen (its print styles). `jobName` names the job, so "Save as PDF" suggests a useful file name
 * such as "فاتورة INV-000034 - محمد العلي" instead of the app's name: the page title carries it until 'afterprint'.
 */
export function print(jobName?: string): void {
  const name = printJobName(jobName)
  if (name && typeof document !== 'undefined') {
    if (titleBeforePrint === null) titleBeforePrint = document.title
    document.title = name
    const restore = () => {
      window.removeEventListener('afterprint', restore)
      if (titleBeforePrint !== null) { document.title = titleBeforePrint; titleBeforePrint = null }
    }
    window.addEventListener('afterprint', restore)
  }
  const p = platform()
  if (p === 'electron' && window.dentora) { void window.dentora.print(); return }
  if (p === 'android' && window.DentoraAndroid) {
    // the job name goes with the call: the shell reads it at once, before a title change could reach it
    if (name) window.DentoraAndroid.print(name); else window.DentoraAndroid.print()
    return
  }
  window.print()
}

// ---- the Android back button --------------------------------------------------------------------------------
// The Android shell asks window.__dentoraBack() first on every press of the back key (or gesture): true means the
// page handled it. It closes the top-most dialog, drawer or menu (the same one Escape closes), then lets a screen
// with steps of its own (the setup wizard) go back a step; otherwise the shell goes back a page or leaves the app.
const backHandlers: Array<() => boolean> = []
/**
 * Lets a screen take the back key while it is shown: `handler` returns true when it did something (a wizard went
 * back a step), false to let the key go on. Returns the function that removes it (use it as an effect's cleanup).
 */
export function onBackButton(handler: () => boolean): () => void {
  backHandlers.push(handler)
  return () => { const i = backHandlers.lastIndexOf(handler); if (i >= 0) backHandlers.splice(i, 1) }
}
/** One press of the back key: true when the page used it. */
export function handleBackButton(): boolean {
  if (closeTopLayer()) return true
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    try { if (backHandlers[i]()) return true } catch { /* a broken handler must not trap the back key */ }
  }
  return false
}
if (typeof window !== 'undefined') window.__dentoraBack = handleBackButton

export function openExternal(url: string): void {
  const p = platform()
  if (p === 'electron' && window.dentora) { void window.dentora.openExternal(url); return }
  if (p === 'android' && window.DentoraAndroid) { window.DentoraAndroid.openExternal(url); return }
  window.open(url, '_blank', 'noopener')
}

/** A stable id for this installation: the machine on Windows, ANDROID_ID on Android, a stored random id on the web. */
export async function rawDeviceId(): Promise<string> {
  const p = platform()
  try {
    if (p === 'electron' && window.dentora) { const id = await window.dentora.deviceId(); if (id) return id }
    if (p === 'android' && window.DentoraAndroid) { const id = window.DentoraAndroid.deviceId(); if (id) return id }
  } catch { /* fall through to the stored id */ }
  const KEY = 'dentora.device'
  let id = ''
  try { id = localStorage.getItem(KEY) || '' } catch { /* private mode */ }
  if (!id) {
    const b = new Uint8Array(16); crypto.getRandomValues(b)
    id = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
    try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  }
  return id
}

/** Reads an image file into a downsized JPEG/PNG data URL (for logos, patient photos, thumbnails). */
export async function imageToDataUrl(file: Blob, maxSide = 512, quality = 0.86): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    const png = file.type === 'image/png' || file.type === 'image/svg+xml'
    return canvas.toDataURL(png ? 'image/png' : 'image/jpeg', quality)
  } finally { URL.revokeObjectURL(url) }
}
