// One door to the device: Electron (Windows), the Android shell, or a plain browser.
// Screens never touch window.pos / window.PosAndroid directly.

export type PlatformKind = 'electron' | 'android' | 'web'

function detect(): PlatformKind {
  if (typeof window === 'undefined') return 'web'
  if (window.pos?.platform === 'electron') return 'electron'
  if (window.PosAndroid) return 'android'
  return 'web'
}

const WEB_ID_KEY = 'kaseb.device'
function webDeviceId(): string {
  try {
    let id = localStorage.getItem(WEB_ID_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(WEB_ID_KEY, id) }
    return id
  } catch { return 'web-unknown' }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export const platform = {
  kind: detect() as PlatformKind,
  get isDesktop(): boolean { return this.kind === 'electron' },
  get isAndroid(): boolean { return this.kind === 'android' },
  get isWeb(): boolean { return this.kind === 'web' },
  /** Touch-first layout (phones and tablets). */
  get isTouch(): boolean { return this.kind === 'android' || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) },

  async deviceId(): Promise<string> {
    try {
      if (this.kind === 'electron') return (await window.pos!.deviceId()) || webDeviceId()
      if (this.kind === 'android') return window.PosAndroid!.deviceId() || webDeviceId()
    } catch { /* fall through */ }
    return webDeviceId()
  },
  async deviceName(): Promise<string> {
    try {
      if (this.kind === 'electron') return await window.pos!.deviceName()
      if (this.kind === 'android') return window.PosAndroid!.deviceName()
    } catch { /* fall through */ }
    return navigator.userAgent.includes('Mobile') ? 'Phone (web)' : 'Computer (web)'
  },
  /** SHA-256 of the Android signing certificate, or 'electron' / 'web'. */
  async appSignature(): Promise<string> {
    try {
      if (this.kind === 'android') return window.PosAndroid!.signature()
      if (this.kind === 'electron') return await window.pos!.appSignature()
    } catch { /* fall through */ }
    return 'web'
  },
  appVersion(): string {
    try {
      if (this.kind === 'android') return window.PosAndroid!.version() || __POS_VERSION__
      if (this.kind === 'electron') return window.pos!.version || __POS_VERSION__
    } catch { /* fall through */ }
    return __POS_VERSION__
  },

  /** Saves a file where the user chooses (Electron and Android open a picker; the browser downloads it). */
  async saveFile(name: string, mime: string, data: Blob | string): Promise<boolean> {
    try {
      if (this.kind === 'electron') {
        const b64 = typeof data === 'string' ? textToBase64(data) : await blobToBase64(data)
        return await window.pos!.saveFile(name, mime, b64, true)
      }
      if (this.kind === 'android') {
        const b64 = typeof data === 'string' ? textToBase64(data) : await blobToBase64(data)
        return await new Promise<boolean>(resolve => {
          window.onPosFileSaved = ok => { window.onPosFileSaved = undefined; resolve(ok) }
          window.PosAndroid!.saveFile(name, mime, b64)
          setTimeout(() => { if (window.onPosFileSaved) { window.onPosFileSaved = undefined; resolve(true) } }, 120000)
        })
      }
    } catch { /* fall through to the browser download */ }
    const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
    return true
  },

  /** Prints a complete HTML document (a receipt). */
  async print(html: string, opts: { printer?: string; silent?: boolean; widthMm?: number; copies?: number } = {}): Promise<boolean> {
    try {
      if (this.kind === 'electron') return await window.pos!.print(html, opts)
      if (this.kind === 'android') { window.PosAndroid!.print(html); return true }
    } catch { /* fall through */ }
    return printInBrowser(html)
  },
  async getPrinters(): Promise<{ name: string; isDefault: boolean }[]> {
    try { if (this.kind === 'electron') return await window.pos!.getPrinters() } catch { /* none */ }
    return []
  },

  async share(text: string, title?: string): Promise<boolean> {
    try {
      if (this.kind === 'android') { window.PosAndroid!.share(text); return true }
      if (navigator.share) { await navigator.share({ text, title }); return true }
      await navigator.clipboard.writeText(text)
      return true
    } catch { return false }
  },
  async copy(text: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  },
  openUrl(url: string): void {
    try {
      if (this.kind === 'electron') { void window.pos!.openExternal(url); return }
      if (this.kind === 'android') { window.PosAndroid!.openUrl(url); return }
    } catch { /* fall through */ }
    window.open(url, '_blank', 'noopener')
  },
  /** Where the license token lives: outside the page on Electron/Android, localStorage on the web. */
  license: {
    async get(): Promise<string | null> {
      try {
        if (platform.kind === 'electron') return await window.pos!.licenseGet()
        if (platform.kind === 'android') return window.PosAndroid!.licenseGet() || null
        return localStorage.getItem('kaseb.license')
      } catch { return null }
    },
    async set(v: string | null): Promise<void> {
      try {
        if (platform.kind === 'electron') return await window.pos!.licenseSet(v)
        if (platform.kind === 'android') return window.PosAndroid!.licenseSet(v ?? '')
        if (v === null) localStorage.removeItem('kaseb.license'); else localStorage.setItem('kaseb.license', v)
      } catch { /* ignore */ }
    },
  },
  keepScreenOn(on: boolean): void {
    try { if (this.kind === 'android') window.PosAndroid!.keepScreenOn(on) } catch { /* ignore */ }
  },
  setFullscreen(on: boolean): void {
    try {
      if (this.kind === 'electron') { void window.pos!.setFullscreen(on); return }
      if (on) void document.documentElement.requestFullscreen?.(); else void document.exitFullscreen?.()
    } catch { /* ignore */ }
  },
}

function printInBrowser(html: string): Promise<boolean> {
  return new Promise(resolve => {
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(f)
    const done = () => { setTimeout(() => f.remove(), 1000); resolve(true) }
    f.onload = () => {
      try {
        const w = f.contentWindow!
        w.onafterprint = done
        w.focus(); w.print()
        setTimeout(done, 60000)
      } catch { done() }
    }
    f.srcdoc = html
  })
}
