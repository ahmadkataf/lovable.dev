// Getting out of a stuck state without the user having to kill the app: a small local log of the errors that reached
// the page (so a shop owner can send the details to support), and a restart that is a real restart where the shell
// offers one (Electron relaunches the process, Android starts a new process) and a page reload elsewhere.
import { platform } from './platform'

const KEY = 'kaseb.errors'
const MAX = 20

export interface LoggedError { at: number; where: string; name: string; message: string }

/** Rejects with a named error when `p` takes longer than `ms` (the work itself goes on; its late result is ignored here). */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, name = 'Timeout'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => { const e = new Error(`no answer after ${ms / 1000} s`); e.name = name; reject(e) }, ms)
    Promise.resolve(p).then(v => { clearTimeout(id); resolve(v) }, e => { clearTimeout(id); reject(e) })
  })
}

/** Turns anything thrown into a short { name, message } (DOMException / Dexie errors keep their names). */
export function describeError(err: unknown): { name: string; message: string } {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown; inner?: unknown }
    const inner = e.inner && typeof e.inner === 'object' ? (e.inner as { name?: unknown; message?: unknown }) : null
    const name = String(e.name || 'Error')
    let message = String(e.message ?? '')
    // Dexie repeats the browser's text: "X. QuotaExceededError: X." → "X."
    const rep = ` ${name}: `
    const at = message.indexOf(rep)
    if (at > 0 && message.slice(0, at) === message.slice(at + rep.length)) message = message.slice(0, at)
    // Dexie wraps the real IndexedDB error (UnknownError, QuotaExceededError…) in OpenFailedError / DatabaseClosedError
    const innerMsg = inner ? String(inner.message ?? '') : ''
    if (inner && inner.name && !message.includes(String(inner.name)) && !(innerMsg && message.includes(innerMsg))) message = `${message} (${String(inner.name)}: ${innerMsg})`
    return { name, message: message.slice(0, 400) }
  }
  return { name: 'Error', message: String(err).slice(0, 400) }
}

// Android keeps the log natively: a restart there ends the process at once and can drop the WebView's last
// localStorage writes — the very error that made the user restart.
const nativeLog = (): PosAndroidBridge | null => {
  try { return platform.kind === 'android' && typeof window.PosAndroid?.errorsGet === 'function' ? window.PosAndroid : null } catch { return null }
}
function loadLog(): string | null {
  const n = nativeLog()
  if (n) { try { return n.errorsGet!() || null } catch { /* fall back */ } }
  try { return localStorage.getItem(KEY) } catch { return null }
}
function saveLog(v: string): void {
  const n = nativeLog()
  if (n) { try { n.errorsSet!(v); return } catch { /* fall back */ } }
  try { localStorage.setItem(KEY, v) } catch { /* storage unavailable: nothing to keep */ }
}

export function readErrors(): LoggedError[] {
  try {
    const v = JSON.parse(loadLog() || '[]')
    return Array.isArray(v) ? v.filter(x => x && typeof x === 'object').slice(-MAX) : []
  } catch { return [] }
}

/** Keeps the last few errors on this device (never sent anywhere by itself). */
export function logError(where: string, err: unknown): void {
  try {
    const d = describeError(err)
    const list = readErrors()
    const last = list[list.length - 1]
    // the same error over and over (a retry loop, a re-render) is one entry
    if (last && last.name === d.name && last.message === d.message && last.where === where && Date.now() - last.at < 60000) return
    list.push({ at: Date.now(), where, ...d })
    saveLog(JSON.stringify(list.slice(-MAX)))
  } catch { /* storage unavailable: nothing to keep */ }
  try { console.error(`[kaseb] ${where}`, err) } catch { /* ignore */ }
}

/** A plain-text summary for support (copied or sent over WhatsApp by the shop owner). */
export function errorReport(extra?: string): string {
  const lines = [`Kaseb ${platform.appVersion()} · ${platform.kind}`, `UA: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`]
  if (extra) lines.push(extra)
  for (const e of readErrors().slice(-8)) lines.push(`${new Date(e.at).toISOString()} [${e.where}] ${e.name}: ${e.message}`)
  return lines.join('\n')
}

let installed = false
/** Errors nobody caught still end up in the log. */
export function installErrorLog(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', e => { logError('window', e.error ?? e.message) })
  window.addEventListener('unhandledrejection', e => { logError('promise', e.reason) })
}

let restartGuard: (() => Promise<boolean>) | null = null
/** The running app asks before a restart that would lose something (the open cart). */
export function setRestartGuard(fn: (() => Promise<boolean>) | null): void { restartGuard = fn }

/** What the user would do by hand: close the app and open it again (a new process on Windows and Android). From
 *  inside the running app (`ask`), the guard first asks when the open cart would be lost. The start-up, error and
 *  crash cards ask inside the card instead (BootScreen's RestartActions: the app's confirm dialog is not mounted). */
export async function restartApp(opts: { ask?: boolean } = {}): Promise<void> {
  if (opts.ask && restartGuard) { try { if (!(await restartGuard())) return } catch { /* restart anyway */ } }
  try {
    if (platform.kind === 'electron' && typeof window.pos?.relaunch === 'function') { await window.pos.relaunch(); return }
    if (platform.kind === 'android' && typeof window.PosAndroid?.restartApp === 'function') { window.PosAndroid.restartApp(); return }
  } catch { /* fall back to reloading the page */ }
  // a page reload: start from the sales screen and the lock screen, as a real restart would
  try { sessionStorage.removeItem('kaseb.user') } catch { /* ignore */ }
  try { history.replaceState(null, '', location.pathname + location.search + '#/') } catch { /* ignore */ }
  try { location.reload() } catch { /* nothing else to do */ }
}
