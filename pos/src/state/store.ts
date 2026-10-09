import { create } from 'zustand'
import { db, loadSettings, saveSettings, ensureDefaults } from '../db'
import type { Settings, User, Shift, Product } from '../db/types'
import { type Cart, type CartLine, emptyCart, addToCart, lineFromProduct, setLineQty, updateLine, removeLine } from '../lib/cart'
import { setLang, applyLangToDocument } from '../i18n'
import { configureFeedback } from '../lib/audio'
import type { LicenseStatus } from '../license/types'
import { license } from '../license'
import { setAuditActor } from '../lib/audit'

export interface Toast { id: number; text: string; kind: 'info' | 'success' | 'error' | 'warn' }
export interface ConfirmOptions { title: string; text?: string; okLabel?: string; cancelLabel?: string; danger?: boolean }
export interface ConfirmRequest extends ConfirmOptions { resolve: (ok: boolean) => void }

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export interface AppState {
  ready: boolean
  settings: Settings
  user: User | null
  users: User[]
  shift: Shift | null
  license: LicenseStatus
  cart: Cart
  toasts: Toast[]
  confirmReq: ConfirmRequest | null
  cameraOpen: boolean
  sidebarMini: boolean

  boot(): Promise<void>
  updateSettings(patch: DeepPartial<Settings>): Promise<void>
  reloadUsers(): Promise<void>
  login(user: User): void
  logout(): void
  setShift(s: Shift | null): void
  reloadShift(): Promise<void>
  setLicense(s: LicenseStatus): void

  addProduct(p: Product, qty?: number): void
  addLine(line: CartLine): void
  setQty(key: string, qty: number): void
  patchLine(key: string, patch: Partial<CartLine>): void
  removeLine(key: string): void
  setCart(c: Cart): void
  clearCart(): void
  setCartDiscount(amount: number, pct?: number): void
  setCartCustomer(id?: string, name?: string): void
  setCartNote(note: string): void

  toast(text: string, kind?: Toast['kind']): void
  dismissToast(id: number): void
  confirm(opts: ConfirmOptions): Promise<boolean>
  resolveConfirm(ok: boolean): void
  setCameraOpen(open: boolean): void
  setSidebarMini(mini: boolean): void
}

let toastSeq = 1
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null

export function applyTheme(theme: Settings['theme']): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const set = (dark: boolean) => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }
  if (mediaListener) { mq.removeEventListener('change', mediaListener); mediaListener = null }
  if (theme === 'system') { set(mq.matches); mediaListener = e => set(e.matches); mq.addEventListener('change', mediaListener) }
  else set(theme === 'dark')
  const meta = document.querySelector('meta[name=theme-color]')
  if (meta) meta.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#121b2d' : '#ffffff')
}

function mergeDeep<T extends object>(base: T, patch: DeepPartial<T>): T {
  const out: any = { ...base }
  for (const k of Object.keys(patch) as (keyof T)[]) {
    const v = patch[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) out[k] = mergeDeep(base[k] as any, v as any)
    else if (v !== undefined) out[k] = v
  }
  return out
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  settings: undefined as unknown as Settings,
  user: null,
  users: [],
  shift: null,
  license: { state: 'demo', deviceCode: '', checking: true, online: true },
  cart: emptyCart(),
  toasts: [],
  confirmReq: null,
  cameraOpen: false,
  sidebarMini: (() => { try { return localStorage.getItem('kaseb.sidebar') === 'mini' } catch { return false } })(),

  async boot() {
    await ensureDefaults()
    const settings = await loadSettings()
    setLang(settings.lang); applyLangToDocument(); applyTheme(settings.theme)
    configureFeedback({ sound: settings.pos.soundOn, vibrate: settings.pos.vibrate })
    const users = await db.users.where('active').equals(1 as any).toArray().catch(() => [] as User[])
    const allUsers = users.length ? users : (await db.users.toArray()).filter(u => u.active)
    const shift = (await db.shifts.where('status').equals('open').first()) ?? null
    // one user without a PIN and no PIN requirement: walk straight in
    let user: User | null = null
    if (!settings.pos.requirePin) {
      const open = allUsers.filter(u => !u.pinHash)
      if (open.length === 1 && allUsers.length === 1) user = open[0]
    }
    // restore the last user of this session (page reloads inside the app)
    try {
      const last = sessionStorage.getItem('kaseb.user')
      const u = last ? allUsers.find(x => x.id === last) : undefined
      if (u) user = u
    } catch { /* ignore */ }
    license.subscribe(s => set({ license: s }))
    const lic = await license.init()
    set({ settings, users: allUsers, shift, user, license: lic, ready: true })
  },

  async updateSettings(patch) {
    const settings = mergeDeep(get().settings, patch)
    await saveSettings(settings)
    if (patch.lang) setLang(settings.lang)
    if (patch.theme) applyTheme(settings.theme)
    if (patch.pos) configureFeedback({ sound: settings.pos.soundOn, vibrate: settings.pos.vibrate })
    set({ settings })
  },
  async reloadUsers() {
    const users = (await db.users.toArray()).filter(u => u.active)
    const cur = get().user
    set({ users, user: cur ? users.find(u => u.id === cur.id) ?? null : null })
  },
  login(user) { try { sessionStorage.setItem('kaseb.user', user.id) } catch { /* ignore */ } set({ user }) },
  logout() { try { sessionStorage.removeItem('kaseb.user') } catch { /* ignore */ } set({ user: null }) },
  setShift(shift) { set({ shift }) },
  async reloadShift() { set({ shift: (await db.shifts.where('status').equals('open').first()) ?? null }) },
  setLicense(license) { set({ license }) },

  addProduct(p, qty = 1) {
    const s = get()
    set({ cart: addToCart(s.cart, lineFromProduct(p, qty, s.settings.tax.rate)) })
  },
  addLine(line) { set({ cart: addToCart(get().cart, line) }) },
  setQty(key, qty) { set({ cart: setLineQty(get().cart, key, qty) }) },
  patchLine(key, patch) { set({ cart: updateLine(get().cart, key, patch) }) },
  removeLine(key) { set({ cart: removeLine(get().cart, key) }) },
  setCart(cart) { set({ cart }) },
  clearCart() { set({ cart: emptyCart() }) },
  setCartDiscount(amount, pct) { set({ cart: { ...get().cart, discount: amount, discountPct: pct } }) },
  setCartCustomer(customerId, customerName) { set({ cart: { ...get().cart, customerId, customerName } }) },
  setCartNote(note) { set({ cart: { ...get().cart, note: note || undefined } }) },

  toast(text, kind = 'info') {
    const id = toastSeq++
    set({ toasts: [...get().toasts, { id, text, kind }].slice(-4) })
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 4500 : 2600)
  },
  dismissToast(id) { set({ toasts: get().toasts.filter(t => t.id !== id) }) },
  confirm(opts) { return new Promise<boolean>(resolve => set({ confirmReq: { ...opts, resolve } })) },
  resolveConfirm(ok) { const r = get().confirmReq; set({ confirmReq: null }); r?.resolve(ok) },
  setCameraOpen(cameraOpen) { set({ cameraOpen }) },
  setSidebarMini(sidebarMini) { try { localStorage.setItem('kaseb.sidebar', sidebarMini ? 'mini' : 'full') } catch { /* ignore */ } set({ sidebarMini }) },
}))

/** Shortcuts used everywhere. */
export const toast = (text: string, kind?: Toast['kind']): void => useStore.getState().toast(text, kind)
export const confirmDialog = (opts: ConfirmOptions): Promise<boolean> => useStore.getState().confirm(opts)
export const useSettings = (): Settings => useStore(s => s.settings)
export const useCurrency = () => useStore(s => s.settings.currency)
export const useUser = (): User | null => useStore(s => s.user)
export const isAdmin = (u: User | null): boolean => !!u && u.role === 'admin'

setAuditActor(() => { const u = useStore.getState().user; return u ? { id: u.id, name: u.name } : null })
