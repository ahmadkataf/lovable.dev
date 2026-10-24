import { create } from 'zustand'
import { db, loadSettings, saveSettings, ensureDefaults, reopenDb } from '../db'
import type { Settings, User, Shift, Product, RateHistoryEntry } from '../db/types'
import { type Cart, type CartLine, emptyCart, addToCart, lineFromProduct, setLineQty, updateLine, removeLine, refreshCartPrices } from '../lib/cart'
import { setLang, applyLangToDocument, t } from '../i18n'
import { setExchangeRate as setExchangeRateLib, formatRate } from '../lib/fx'
import { formatNumber } from '../lib/money'
import { configureFeedback } from '../lib/audio'
import type { LicenseStatus } from '../license/types'
import { license } from '../license'
import { setAuditActor } from '../lib/audit'
import { logError, describeError, withTimeout } from '../lib/recovery'
import { onDatabaseLost } from '../lib/live'

export interface Toast { id: number; text: string; kind: 'info' | 'success' | 'error' | 'warn' }
export interface ConfirmOptions { title: string; text?: string; okLabel?: string; cancelLabel?: string; danger?: boolean }
export interface ConfirmRequest extends ConfirmOptions { resolve: (ok: boolean) => void }

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export interface AppState {
  ready: boolean
  /** Starting failed after the automatic retries (the database could not be opened…): the recovery screen shows it. */
  /** Why the app is not open: a start that failed or is slow (BootTimeout), or the database lost mid-session (`lost`). */
  bootError: { name: string; message: string; lost?: boolean } | null
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
  /** The recovery screen's "try again": reopens the database and starts over without reloading the page. */
  retryBoot(): Promise<void>
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
  setCartRedeem(points: number, amount: number): void
  setCartNote(note: string): void
  /** THE way the exchange rate changes (lib/fx setExchangeRate + the settings in memory + the open cart + a toast). */
  setExchangeRate(rate: number, source: RateHistoryEntry['source'], repriceCart?: boolean): Promise<{ repriced: number; prev: number }>
  /** Re-derives the open cart's non-overridden lines from the products as they are now; returns how many lines changed. */
  refreshCartPrices(): Promise<number>

  toast(text: string, kind?: Toast['kind']): void
  dismissToast(id: number): void
  confirm(opts: ConfirmOptions): Promise<boolean>
  resolveConfirm(ok: boolean): void
  setCameraOpen(open: boolean): void
  setSidebarMini(mini: boolean): void
}

let toastSeq = 1
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null

// ---------- starting the app ----------
// Everything the first screen needs comes from IndexedDB, which can fail or stall on a real device (low storage, an
// I/O hiccup, "Internal error opening backing store", a lock held by another process). Before this, one failure left
// the loading spinner up for good — only killing the app helped. Now a failed open is reopened and retried; an open
// that is merely slow (a busy disk, a schema upgrade on a big shop) is never cancelled — after the time limit the
// screen says so and offers a restart while the app keeps waiting and opens by itself when it finishes.
/** How long one start attempt may take, and the pauses before the retries (tests shorten them). */
export const bootTuning = { attemptMs: 20000, retryDelays: [1500, 4000] }
let bootRun: Promise<void> | null = null
let licenseSubscribed = false

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const errName = (e: unknown): string => String((e as { name?: unknown } | null)?.name ?? '')
/** A database whose open failed (not one still opening): only that may be closed and opened again. */
const dbFailed = () => db.hasFailed() && !db.isOpen()

// The shop's language and theme, kept outside the database too: the start-up screens (and the error card when the
// database cannot be opened) appear in them before the settings are readable.
const UI_KEY = 'kaseb.ui'
function rememberUi(s: Pick<Settings, 'lang' | 'theme'>): void {
  try { localStorage.setItem(UI_KEY, JSON.stringify({ lang: s.lang, theme: s.theme })) } catch { /* not important */ }
}
/** Applies the remembered language and theme (main.tsx, before the first render); the system theme otherwise. */
export function applyRememberedUi(): void {
  let v: Partial<Pick<Settings, 'lang' | 'theme'>> = {}
  try { v = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {} } catch { /* none */ }
  if (v.lang === 'ar' || v.lang === 'en') { setLang(v.lang); applyLangToDocument() }
  applyTheme(v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system')
}

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
  bootError: null,
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
    if (get().ready) return
    if (bootRun) return bootRun
    const load = async () => {
      await ensureDefaults()
      const settings = await loadSettings()
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
      if (!licenseSubscribed) { licenseSubscribed = true; license.subscribe(s => set({ license: s })) }
      await license.init()
      return { settings, users: allUsers, shift, user }
    }
    const apply = (d: Awaited<ReturnType<typeof load>>) => {
      if (get().ready) return
      setLang(d.settings.lang); applyLangToDocument(); applyTheme(d.settings.theme); rememberUi(d.settings)
      configureFeedback({ sound: d.settings.pos.soundOn, vibrate: d.settings.pos.vibrate })
      // the licence as it is now (init() keeps answering its first result; a second start after the database was
      // lost must not bring back the state from before an activation)
      set({ ...d, license: license.get(), ready: true, bootError: null })
    }
    bootRun = (async () => {
      let lastErr: unknown = null
      for (let attempt = 0; attempt <= bootTuning.retryDelays.length; attempt++) {
        if (get().ready) return
        if (attempt > 0) {
          await sleep(bootTuning.retryDelays[attempt - 1])
          if (get().ready) return
          // reopen only an open that FAILED; one still in progress joins the next attempt (a new native open would only
          // queue behind it, and cancelling it would roll back a schema upgrade)
          if (dbFailed()) {
            try { await reopenDb() } catch (e) {
              lastErr = e; logError('boot-reopen', e)
              // a reopen that is only slow is still running: this attempt waits for it (below), nothing new is started
              if (errName(e) !== 'DbOpenTimeout') continue
            }
          }
        }
        const run = load()
        try { apply(await withTimeout(run, bootTuning.attemptMs, 'BootTimeout')); return } catch (e) {
          lastErr = e; logError('boot', e)
          if (errName(e) !== 'BootTimeout') continue
          // slow, not failed: say so (restart offered) and keep waiting on this same attempt — it opens the app
          // whenever it finishes; if it fails after all, the retries go on and the real error is shown at the end
          if (!get().ready) set({ bootError: describeError(e) })
          try { apply(await run); return } catch (late) { lastErr = late; logError('boot', late) }
        }
      }
      if (!get().ready) set({ bootError: describeError(lastErr) })
    })().finally(() => { bootRun = null })
    return bootRun
  },
  async retryBoot() {
    set({ bootError: null })
    // a failed open gets a new one; a start that is still running is simply joined again
    if (dbFailed()) { try { await reopenDb() } catch (e) { logError('boot-reopen', e) } }
    await get().boot()
  },

  async updateSettings(patch) {
    const settings = mergeDeep(get().settings, patch)
    await saveSettings(settings)
    if (patch.lang) setLang(settings.lang)
    if (patch.theme) applyTheme(settings.theme)
    if (patch.lang || patch.theme) rememberUi(settings)
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
  setCartCustomer(customerId, customerName) {
    const c = get().cart
    const changed = c.customerId !== customerId
    set({ cart: { ...c, customerId, customerName, ...(changed && c.redeemPoints ? { redeemPoints: undefined, discount: 0, discountPct: undefined } : {}) } })
  },
  setCartRedeem(points, amount) {
    const c = get().cart
    set({ cart: points > 0 ? { ...c, redeemPoints: points, discount: amount, discountPct: undefined } : { ...c, redeemPoints: undefined, discount: 0 } })
  },
  setCartNote(note) { set({ cart: { ...get().cart, note: note || undefined } }) },
  async setExchangeRate(rate, source, repriceCart = true) {
    const s = get()
    const res = await setExchangeRateLib({ rate, settings: s.settings, user: s.user, source })
    set({ settings: res.settings })
    if (repriceCart) await get().refreshCartPrices()
    const c2 = res.settings.currency2
    get().toast(t('fx.done', { cur: c2.symbol, rate: formatRate(c2.rate, res.settings), n: formatNumber(res.repriced) }), 'success')
    return { repriced: res.repriced, prev: res.prev }
  },
  async refreshCartPrices() {
    const cart = get().cart
    const ids = [...new Set(cart.lines.map(l => l.productId).filter((id): id is string => !!id))]
    if (!ids.length) return 0
    const products = (await db.products.bulkGet(ids)).filter((p): p is Product => !!p)
    const tier = cart.customerId ? (await db.customers.get(cart.customerId))?.tier : undefined
    const res = refreshCartPrices(cart, products, tier)
    // the cart may have moved while we read: patch only the lines we looked at, by key
    if (res.changed) {
      const byKey = new Map(res.cart.lines.map(l => [l.key, l]))
      const cur = get().cart
      set({ cart: { ...cur, lines: cur.lines.map(l => byKey.get(l.key) ?? l) } })
    }
    return res.changed
  },

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
onDatabaseLost(err => { if (!bootRun) useStore.setState({ ready: false, bootError: { ...describeError(err), lost: true } }) })
// the database came back by itself (live.ts keeps trying) while the "lost" card is up: carry on without a tap
db.on('ready', () => {
  setTimeout(() => {
    const s = useStore.getState()
    if (!s.ready && s.bootError?.lost && !bootRun) void s.retryBoot()
  }, 0)
}, true)
