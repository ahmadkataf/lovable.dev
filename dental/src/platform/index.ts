// What the web app asks of the device it runs on. Three hosts share the same code:
//   browser  — downloads and <input type=file>
//   Electron — window.dentora (preload bridge): native save/open dialogs, machine id, print
//   Android  — window.DentoraAndroid (JavascriptInterface): saveFile / print / deviceId; file picking goes
//              through the WebView's file chooser, so <input type=file> keeps working.

export type Platform = 'web' | 'electron' | 'android'

interface ElectronBridge {
  platform: 'electron'
  deviceId(): Promise<string>
  saveFile(name: string, mime: string, base64: string): Promise<boolean>
  openFile(accept: string): Promise<{ name: string; mime: string; base64: string } | null>
  print(): Promise<void>
  appVersion(): Promise<string>
  openExternal(url: string): Promise<void>
}
interface AndroidBridge {
  deviceId(): string
  saveFile(name: string, mime: string, base64: string): boolean | Promise<boolean>   // the Android shell wraps it in a Promise
  print(): void
  appVersion(): string
  openExternal(url: string): void
}
declare global {
  interface Window { dentora?: ElectronBridge; DentoraAndroid?: AndroidBridge }
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

export function appVersion(): string {
  try { return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1.0.0' } catch { return '1.0.0' }
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] || '')
    r.onerror = rej
    r.readAsDataURL(b)
  })
}
function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64); const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Saves a file where the user can find it (Downloads, or a save dialog). Resolves false when cancelled. */
export async function saveFile(name: string, blob: Blob): Promise<boolean> {
  const mime = blob.type || 'application/octet-stream'
  const p = platform()
  if (p === 'electron' && window.dentora) return window.dentora.saveFile(name, mime, await blobToBase64(blob))
  if (p === 'android' && window.DentoraAndroid) return window.DentoraAndroid.saveFile(name, mime, await blobToBase64(blob))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.style.display = 'none'
  document.body.appendChild(a); a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 4000)
  return true
}
export async function saveText(name: string, text: string, mime = 'application/json'): Promise<boolean> {
  return saveFile(name, new Blob([text], { type: mime }))
}

/** Lets the user pick one file. Resolves null when cancelled. */
export async function pickFile(accept = '*/*'): Promise<File | null> {
  if (platform() === 'electron' && window.dentora) {
    const r = await window.dentora.openFile(accept)
    if (!r) return null
    return new File([base64ToBlob(r.base64, r.mime)], r.name, { type: r.mime })
  }
  return new Promise(res => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = accept; input.style.display = 'none'
    let done = false
    const finish = (f: File | null) => { if (done) return; done = true; res(f); setTimeout(() => input.remove(), 0) }
    input.onchange = () => finish(input.files?.[0] ?? null)
    input.addEventListener('cancel', () => finish(null))   // Chrome 113+ and Android WebView
    // a cancelled picker fires no change event: notice when the window regains focus
    const onFocus = () => { window.removeEventListener('focus', onFocus); setTimeout(() => finish(input.files?.[0] ?? null), 600) }
    window.addEventListener('focus', onFocus)
    document.body.appendChild(input); input.click()
  })
}

export function print(): void {
  const p = platform()
  if (p === 'electron' && window.dentora) { void window.dentora.print(); return }
  if (p === 'android' && window.DentoraAndroid) { window.DentoraAndroid.print(); return }
  window.print()
}

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
