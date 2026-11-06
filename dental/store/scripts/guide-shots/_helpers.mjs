// Shared machinery of the user guide's picture runner (store/scripts/guide-shots.mjs) and the `helpers` object that
// every shot implementation receives as ctx.helpers. The shot API itself (implementation files, ctx, the Target a
// shot returns, markers, highlights, states) is documented at the top of guide-shots.mjs; this file documents each
// helper where it is defined (see makeHelpers below for the list a shot can call).
//
// Nothing here is specific to one topic. A helper that only one topic needs belongs in that topic's own file
// (store/scripts/guide-shots/<slug>.mjs); one that two topics need can be added here.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { seedAndLogin, loadDemo, requireQaHandle, BASE, PORT } from '../../../scripts/qa/lib.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export { BASE }
/** The app's address; routes are hashes: `${APP}#/patients`. */
export const APP = `${BASE}/index.html`
/** Sunday 11 October 2026, 11:40 in Damascus: a working day of the demo clinic (the same clock as store/scripts/shoot.mjs). */
export const NOW = new Date(process.env.GUIDE_NOW || process.env.STORE_NOW || '2026-10-11T11:40:00+03:00')
export const TIMEZONE = 'Asia/Damascus'
export const BRAND = '#0E8F86'
export const ADMIN_ID = 'u-admin'

/**
 * The two devices of the guide. `widths` are the WebP files made of every picture (never wider than the capture);
 * `display` is about how wide the guide shows a whole-window picture, which sets the size of markers and outlines.
 */
export const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, scale: 2, mobile: false, widths: [1600, 900], display: 800 },
  phone: { viewport: { width: 390, height: 844 }, scale: 3, mobile: true, widths: [780, 390], display: 390 },
}

/** The app's demo clinic as seedAndLogin() makes it; English shots get English names (as shoot.mjs's englishClinic()). */
export const TEAM = {
  'u-admin': { ar: 'د. أحمد الخطيب', en: 'Dr. Ahmad Al-Khatib', role: 'admin' },
  'u-doc2': { ar: 'د. ليلى حداد', en: 'Dr. Laila Haddad', role: 'doctor' },
  'u-rec': { ar: 'سارة يوسف', en: 'Sara Youssef', role: 'receptionist' },
}
export const PIN = '1234'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ---- browser contexts --------------------------------------------------------------------------------------------

/** Runs in every page before the app: applies a sign-in wish left in window.name by setSession() (as scripts/qa/lib.mjs). */
function applyPendingSession() {
  const PREFIX = 'dentora-qa-session:'
  if (typeof window.name !== 'string' || !window.name.startsWith(PREFIX)) return
  const id = window.name.slice(PREFIX.length)
  window.name = ''
  if (id) sessionStorage.setItem('dentora.session', JSON.stringify({ id, at: Date.now() }))
  else sessionStorage.removeItem('dentora.session')
}

/**
 * A browser context for one language and device: the guide's viewport and pixel density, Damascus time with the
 * clock fixed at NOW, light colour scheme, downloads accepted, the trial bar hidden (the pictures show an activated
 * copy), reports opening on last month (as store/scripts/shoot.mjs), and the same demo record ids at every run
 * (so avatar colours, which follow the ids, are the same in every picture). Returns { ctx, page }.
 */
export async function newContext(browser, deviceName, lang) {
  const device = DEVICES[deviceName]
  const ctx = await browser.newContext({
    viewport: { ...device.viewport }, deviceScaleFactor: device.scale, isMobile: device.mobile, hasTouch: device.mobile,
    locale: lang === 'ar' ? 'ar-SY' : 'en-US', timezoneId: TIMEZONE, colorScheme: 'light', acceptDownloads: true,
  })
  await ctx.addInitScript(() => {
    const css = '[data-qa="trial-bar"]{display:none!important}'
    const add = () => { const s = document.createElement('style'); s.dataset.guide = 'base'; s.textContent = css; document.head.appendChild(s) }
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add)
  })
  await ctx.addInitScript(applyPendingSession)
  // the same record ids at every run: the app makes ids (and avatar colours, which follow them) from
  // crypto.getRandomValues; here it is a seeded generator whose seed changes at every page load (a counter in
  // localStorage), so the demo clinic comes out with the same ids every time while ids made later stay unique
  await ctx.addInitScript(() => {
    let load = 0
    try { load = Number(localStorage.getItem('guide-shots.rng')) || 0; localStorage.setItem('guide-shots.rng', String(load + 1)) } catch { return }
    let a = (0x2545f491 ^ Math.imul(load + 1, 0x9e3779b1)) >>> 0
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0 }
    const real = crypto.getRandomValues.bind(crypto)
    crypto.getRandomValues = function (arr) {
      if (!ArrayBuffer.isView(arr) || arr instanceof Float32Array || arr instanceof Float64Array) return real(arr)
      const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
      for (let i = 0; i < bytes.length; i += 4) { const v = next(); for (let k = 0; k < 4 && i + k < bytes.length; k++) bytes[i + k] = (v >>> (k * 8)) & 255 }
      return arr
    }
  })
  // reports open on last month, as in store/scripts/shoot.mjs (a whole month's daily chart), unless a shot sets
  // another 'dentora.reports.preset'
  await ctx.addInitScript(() => {
    try { if (!localStorage.getItem('dentora.reports.preset')) localStorage.setItem('dentora.reports.preset', 'lastMonth') } catch { /* ignore */ }
  })
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'}`)))
  const page = await ctx.newPage()
  await page.clock.install({ time: NOW })
  return { ctx, page }
}

/** Waits for the network, the fonts and the app's loading spinners and skeletons, then `ms` more. */
export async function settle(page, ms = 500) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  await page.waitForFunction(() => {
    const busy = [...document.querySelectorAll('.skeleton, .empty > .spinner, #root > .empty')]
    return !busy.some(el => el.getClientRects().length > 0)
  }, null, { timeout: 8000, polling: 100 }).catch(() => {})
  if (ms) await page.waitForTimeout(ms)
}

/** Scrolls the window to `top` and holds it there (the app restores older positions on Back/Forward for a second). */
export async function scrollAndHold(page, top) {
  let now = 0
  for (let i = 0; i < 20; i++) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top)
    await page.waitForTimeout(120)
    now = await page.evaluate(() => window.scrollY)
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    if (Math.abs(now - Math.min(top, Math.max(0, max))) <= 1) return now
  }
  return now
}

// ---- the demo clinic ---------------------------------------------------------------------------------------------

/** shoot.mjs's englishClinic(): English team names, clinic name and address for the English pictures. */
export async function englishClinic(page) {
  await page.evaluate(async (team) => {
    const db = window.__dentora.db
    const spec = { 'u-admin': 'General dentistry', 'u-doc2': 'Orthodontics', 'u-rec': undefined }
    for (const [id, t] of Object.entries(team)) if (await db.users.get(id)) await db.users.update(id, { name: t.en, specialty: spec[id] })
    await db.clinic.update('clinic', { name: 'Smile Dental Clinic', nameEn: '', address: 'Al-Jalaa St, Mezzeh, Damascus' })
  }, TEAM)
  await page.reload()
  await page.waitForTimeout(500)
}

/** Waits until the demo clinic is really there and its progress dialog has closed (as shoot.mjs). */
export async function waitForDemo(page, timeout = 120000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const ok = await page.evaluate(async () => {
      const d = window.__dentora.db
      return (await d.patients.count()) >= 60 && (await d.activity.count()) > 50 && (await d.invoices.count()) > 0 && !document.querySelector('[role="dialog"]')
    })
    if (ok) return
    await page.waitForTimeout(250)
  }
  throw new Error('the demo clinic did not finish loading')
}

/**
 * Brings a fresh context to a state: 'demo' (the admin signed in, the demo clinic loaded), 'clinic' (the same clinic
 * and team, signed in, no demo records) or 'fresh' (nothing: the setup wizard of a new installation).
 */
export async function prepareState(page, state, lang) {
  await page.goto(`${APP}#/`)
  await requireQaHandle(page, 20000)
  if (state === 'fresh') {
    await page.goto(`${APP}#/setup`)
    await settle(page, 600)
    return
  }
  // the clock stands still at NOW while the clinic is made: record ids start with the time they were made, so with
  // the seeded random generator of newContext() the demo clinic has the same ids at every run
  await page.clock.setFixedTime(NOW)
  await seedAndLogin(page, { lang })
  if (lang === 'en') await englishClinic(page)
  if (state === 'demo') {
    await loadDemo(page, { timeout: 120000 })
    await waitForDemo(page)
  }
  await page.waitForTimeout(400)
  await page.clock.setSystemTime(NOW)
  await page.reload()
  await settle(page, 600)
}

// ---- database snapshot, restore and change detection --------------------------------------------------------------
// After a lane is prepared its whole database is copied into a second IndexedDB database of the same origin
// ('guide-shots-snapshot', structured clone: patient files keep their Blobs). A shot that changed data (seen by
// comparing a fingerprint of every table before and after it) is followed by a restore in one transaction over every
// table, which is what a backup restore does (the licence guard allows it), instead of loading the demo again.

const SNAP_DB = 'guide-shots-snapshot'

export async function snapshotDb(page) {
  await page.evaluate(async (SNAP_DB) => {
    const db = window.__dentora.db
    const data = {}
    for (const t of db.tables) data[t.name] = await t.toArray()
    await new Promise((resolve, reject) => {
      const req = indexedDB.open(SNAP_DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore('tables')
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const idb = req.result
        const tx = idb.transaction('tables', 'readwrite')
        const store = tx.objectStore('tables')
        store.clear()
        for (const [name, rows] of Object.entries(data)) store.put(rows, name)
        tx.oncomplete = () => { idb.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, SNAP_DB)
}

export async function restoreDb(page) {
  await page.evaluate(async (SNAP_DB) => {
    const db = window.__dentora.db
    const data = await new Promise((resolve, reject) => {
      const req = indexedDB.open(SNAP_DB, 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const idb = req.result
        const out = {}
        const tx = idb.transaction('tables', 'readonly')
        const cursor = tx.objectStore('tables').openCursor()
        cursor.onsuccess = () => { const c = cursor.result; if (c) { out[c.key] = c.value; c.continue() } }
        tx.oncomplete = () => { idb.close(); resolve(out) }
        tx.onerror = () => reject(tx.error)
      }
    })
    if (!data.clinic) throw new Error('no database snapshot to restore')
    await db.transaction('rw', db.tables, async () => {
      for (const t of db.tables) {
        await t.clear()
        if (data[t.name]?.length) await t.bulkPut(data[t.name])
      }
    })
  }, SNAP_DB)
}

/** One short string per table (row count and a hash of its rows); the licence clock's 'lastSeen' is left out. */
export async function fingerprint(page) {
  return page.evaluate(async () => {
    const db = window.__dentora?.db
    if (!db) return null
    const out = {}
    for (const t of db.tables) {
      let rows = await t.toArray()
      if (t.name === 'settings') rows = rows.filter(r => r.key !== 'lastSeen')
      const s = JSON.stringify(rows)
      let h = 5381
      for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0
      out[t.name] = `${rows.length}:${h.toString(36)}`
    }
    return out
  }).catch(() => null)
}
export function sameFingerprint(a, b) {
  if (!a || !b) return false
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if (a[k] !== b[k]) return false
  return true
}
export function fingerprintDiff(a, b) {
  if (!a || !b) return ['(unreadable)']
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== b[k])
}

/** localStorage of the page (an object). */
export async function readLocal(page) {
  return page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k) } return o })
}

/**
 * Puts a prepared ('demo' or 'clinic') page back to its starting point: the database restored if `dirty`,
 * localStorage as it was after preparing, the admin signed in, the clock at NOW, the device's window size, and a
 * fresh load of the dashboard (#/), so no dialog, menu or in-memory state survives from the previous shot.
 */
export async function resetPage(page, lane, { dirty = false } = {}) {
  if (!page.url().startsWith(BASE)) await page.goto(`${APP}#/`)
  await requireQaHandle(page, 20000)
  if (dirty) await restoreDb(page)
  await page.clock.setSystemTime(NOW)
  const vp = DEVICES[lane.device].viewport
  const cur = page.viewportSize()
  if (!cur || cur.width !== vp.width || cur.height !== vp.height) await page.setViewportSize({ ...vp })
  await page.evaluate(({ local, id }) => {
    localStorage.clear()
    for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v)
    window.name = `dentora-qa-session:${id}`
  }, { local: lane.local, id: ADMIN_ID })
  await page.goto(`${APP}#/`)
  await page.reload()
  await requireQaHandle(page, 20000)
  await page.locator('.app-topbar').first().waitFor({ state: 'visible', timeout: 20000 })
  await settle(page, 300)
}

// ---- the app's texts ---------------------------------------------------------------------------------------------
// The app's own dictionaries (src/i18n), read from GUIDE_SRC (default dental/src: the source the QA build was made
// from should be the same). t('patients.newPatient') is the label exactly as the app shows it in that language.

let dicts = null
async function loadDicts() {
  if (dicts) return dicts
  const src = path.resolve(process.env.GUIDE_SRC || path.join(ROOT, 'src'))
  const dir = path.join(src, 'i18n/modules')
  const common = (await import(pathToFileURL(path.join(src, 'i18n/common.ts')).href)).default
  const modules = { common }
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.ts'))) modules[f.slice(0, -3)] = (await import(pathToFileURL(path.join(dir, f)).href)).default
  dicts = modules
  return dicts
}
/** The app's text for `key` in `lang` (as src/i18n's translate(): 'ns.key', or a bare key from common), with {params}. */
export async function translate(lang, key, params) {
  const MODULES = await loadDicts()
  const dot = key.indexOf('.')
  let ns = 'common', k = key
  if (dot > 0 && MODULES[key.slice(0, dot)]) { ns = key.slice(0, dot); k = key.slice(dot + 1) }
  const other = lang === 'ar' ? 'en' : 'ar'
  let s = MODULES[ns]?.[lang]?.[k] ?? MODULES[ns]?.[other]?.[k]
  if (s === undefined && ns !== 'common') s = MODULES.common[lang][key] ?? MODULES.common[other][key]
  if (s === undefined) throw new Error(`no app text for '${key}'`)
  if (params) for (const [p, v] of Object.entries(params)) s = s.split(`{${p}}`).join(String(v))
  return s
}

// ---- markers, highlights and capture -----------------------------------------------------------------------------

const OVERLAY_ID = 'guide-shot-overlay'

/** A locator, a CSS selector, a box {x, y, width, height} (window CSS px) or a point {x, y}, or a list of them. */
function isBoxLike(t) { return t && typeof t === 'object' && typeof t.x === 'number' && typeof t.y === 'number' && typeof t.locator !== 'function' && !('_frame' in t) }

/**
 * The window box (CSS px) of a target: a box or point as given; a locator or selector: the union of every visible
 * element it matches; an array: the union of its parts. null when nothing visible matches.
 */
export async function boxOf(page, target) {
  if (target == null) return null
  if (Array.isArray(target)) {
    const boxes = (await Promise.all(target.map(t => boxOf(page, t)))).filter(Boolean)
    return boxes.length ? unionBoxes(boxes) : null
  }
  if (isBoxLike(target)) return { x: target.x, y: target.y, width: target.width ?? 0, height: target.height ?? 0 }
  const loc = typeof target === 'string' ? page.locator(target) : target
  const n = await loc.count()
  const boxes = []
  for (let i = 0; i < n; i++) {
    const b = await loc.nth(i).boundingBox().catch(() => null)
    if (b && b.width > 0 && b.height > 0) boxes.push(b)
  }
  return boxes.length ? unionBoxes(boxes) : null
}
function unionBoxes(boxes) {
  const x1 = Math.min(...boxes.map(b => b.x)), y1 = Math.min(...boxes.map(b => b.y))
  const x2 = Math.max(...boxes.map(b => b.x + b.width)), y2 = Math.max(...boxes.map(b => b.y + b.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}
async function radiusOf(page, target) {
  if (target == null || isBoxLike(target) || Array.isArray(target)) return null
  const loc = typeof target === 'string' ? page.locator(target) : target
  return loc.first().evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0).catch(() => null)
}
/** What sits on top of page content: the sticky top bar and the phone's bottom bar; and whether `target` is inside a layer above them. */
async function chromeOf(page, target) {
  const layered = (target == null || isBoxLike(target)) ? false : await (async () => {
    const loc = typeof target === 'string' ? page.locator(target) : (Array.isArray(target) ? null : target)
    if (!loc) return false
    return loc.first().evaluate(el => !!el.closest('.overlay, .drawer, .drawer-overlay, [role="dialog"], .menu-portal, .toast-stack, .app-topbar, .app-sidebar, .app-bottomnav')).catch(() => false)
  })()
  const bars = await page.evaluate(() => {
    const vis = el => el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0
    const top = document.querySelector('.app-topbar'), bottom = document.querySelector('.app-bottomnav')
    return { top: vis(top) ? Math.max(0, top.getBoundingClientRect().bottom) : 0, bottom: vis(bottom) ? bottom.getBoundingClientRect().height : 0 }
  })
  return { layered, ...bars }
}

/**
 * Marker diameter and outline width in CSS px for a capture `cssWidth` wide on `deviceName`: the guide shows a
 * picture at most `display` px wide (desktop 800, phone 390) and never wider than the app showed it, so a marker is
 * about 22 px across and an outline about 3 px as the reader sees them.
 */
export function overlayScale(deviceName, cssWidth) {
  const shown = Math.min(DEVICES[deviceName].display, cssWidth)
  const s = shown / cssWidth                      // shown px per CSS px
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  return { marker: Math.round(clamp(23 / s, 24, 42)), line: clamp(3 / s, 2.5, 5.5), s }
}

const PLACES = ['start', 'end', 'top', 'bottom', 'left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'inside-start', 'inside-end', 'inside-top-start', 'inside-top-end', 'after-content', 'center']

/**
 * Centre of a marker of diameter d at `place` around box b (window px); rtl mirrors start/end. `content` is the box
 * of what the target shows (its text, icons, fields), for 'after-content': just after it, inside the target; null
 * when that place does not exist for this target.
 */
function placeCentre(place, b, d, rtl, content) {
  const g = Math.max(5, Math.round(d * 0.22)), r = d / 2
  const left = b.x, right = b.x + b.width, top = b.y, bottom = b.y + b.height, cx = b.x + b.width / 2, cy = b.y + b.height / 2
  const startX = rtl ? right : left, endX = rtl ? left : right, dir = rtl ? -1 : 1    // dir: +1 = towards the end
  const wide = b.width > d * 3
  switch (place) {
    case 'start': return { x: startX - dir * (g + r), y: cy }
    case 'end': return { x: endX + dir * (g + r), y: cy }
    case 'left': return { x: left - g - r, y: cy }
    case 'right': return { x: right + g + r, y: cy }
    case 'top': return { x: wide ? startX + dir * (r + 6) : cx, y: top - g - r }
    case 'bottom': return { x: wide ? startX + dir * (r + 6) : cx, y: bottom + g + r }
    case 'top-start': return { x: startX - dir * r * 0.35, y: top - r * 0.35 }
    case 'top-end': return { x: endX + dir * r * 0.35, y: top - r * 0.35 }
    case 'bottom-start': return { x: startX - dir * r * 0.35, y: bottom + r * 0.35 }
    case 'bottom-end': return { x: endX + dir * r * 0.35, y: bottom + r * 0.35 }
    case 'inside-start': return { x: startX + dir * (g + r), y: cy }
    case 'inside-end': return { x: endX - dir * (g + r), y: cy }
    case 'inside-top-start': return { x: startX + dir * (g + r), y: top + g + r }
    case 'inside-top-end': return { x: endX - dir * (g + r), y: top + g + r }
    case 'center': return { x: cx, y: cy }
    case 'after-content': {
      if (!content) return null
      const x = rtl ? content.x - g - r : content.x + content.width + g + r
      return (rtl ? x - r >= left : x + r <= right) ? { x, y: content.y + content.height / 2 } : null
    }
    default: throw new Error(`unknown marker place '${place}' (one of: ${PLACES.join(', ')})`)
  }
}
const overlaps = (a, b, gap = 2) => a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap
const inside = (a, area) => a.x >= area.x && a.y >= area.y && a.x + a.width <= area.x + area.width && a.y + a.height <= area.y + area.height
/** How far two boxes overlap (the smaller of the overlaps across and down; 0 when apart). */
const depth = (a, b) => Math.max(0, Math.min(Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x), Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)))
const contains = (outer, inner) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1

/**
 * The places tried, in order, for a target of box b in a picture `area` with markers d px across: a block (a card,
 * a panel) gets a free inner corner or one of its outer corners; a wide, short one (a row, a field, a menu item)
 * the side first, then just after its own text; a small one (a button, an icon) a side, above or below.
 */
function placeOrder(b, area, d) {
  if ((b.width > area.width * 0.45 && b.height > d * 3) || b.height > area.height * 0.45)
    return ['inside-top-end', 'top-start', 'top-end', 'start', 'end', 'inside-top-start', 'top', 'bottom', 'bottom-start', 'bottom-end', 'after-content', 'inside-end', 'inside-start', 'center']
  if (b.width >= d * 3.5)
    return ['start', 'after-content', 'inside-end', 'end', 'top', 'bottom', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'inside-start', 'center']
  return ['start', 'end', 'top', 'bottom', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'after-content', 'inside-end', 'inside-start', 'center']
}

/** The box of what each marker's target shows (text, icons, pictures, fields), or null; one page call. */
async function contentBoxes(page, owns) {
  return page.evaluate(owns => owns.map(own => {
    const boxes = []
    const add = (r, clip) => {
      const x1 = Math.max(r.left, clip.left), y1 = Math.max(r.top, clip.top), x2 = Math.min(r.right, clip.right), y2 = Math.min(r.bottom, clip.bottom)
      if (x2 - x1 > 1 && y2 - y1 > 1) boxes.push([x1, y1, x2, y2])
    }
    for (const el of own) {
      const clip = el.getBoundingClientRect()
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || !n.parentElement?.getClientRects().length || getComputedStyle(n.parentElement).visibility === 'hidden') continue
        const range = document.createRange(); range.selectNodeContents(n)
        for (const r of range.getClientRects()) add(r, clip)
      }
      for (const g of el.querySelectorAll('svg, img, canvas, video, input, select, textarea, .avatar, .badge, .kbd')) for (const r of g.getClientRects()) add(r, clip)
      // pills, chips and other drawn boxes inside it (not one that fills it)
      for (const e of el.querySelectorAll('*')) {
        const r = e.getBoundingClientRect()
        if (!r.width || (r.width >= clip.width * 0.85 && r.height >= clip.height * 0.85)) continue
        const cs = getComputedStyle(e)
        if (cs.visibility === 'hidden') continue
        const bg = cs.backgroundColor, clear = bg === 'transparent' || /rgba\([^)]*[ ,/]\s*0(\.0+)?\)$/.test(bg)
        if (!clear || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0) add(r, clip)
      }
      if (el.matches('input, select, textarea, img, svg')) add(clip, clip)
    }
    if (!boxes.length) return null
    const x1 = Math.min(...boxes.map(b => b[0])), y1 = Math.min(...boxes.map(b => b[1])), x2 = Math.max(...boxes.map(b => b[2])), y2 = Math.max(...boxes.map(b => b[3]))
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
  }), owns)
}

/**
 * How much of the page a marker centred at each candidate point would cover or confuse: one point for each of 13
 * points spread over the circle where the topmost element is text, an icon or picture, a form field, a button / link
 * / tab that is not the marker's own target, or a small drawn thing (a pill, a chip, a coloured box); inside its own
 * target only empty space is free. Four more when another control or card is as near to it as its own target, so
 * the marker would read as pointing there. One page call for every candidate of every marker.
 */
async function coverScores(page, cands, owns) {
  return page.evaluate(({ cands, owns }) => {
    const INTERACTIVE = 'button, a[href], label, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"], [role="link"]'
    const GRAPHIC = 'svg, img, canvas, video, input, select, textarea, .avatar, .badge, .kbd'
    const overText = (el, x, y) => {
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue
        const range = document.createRange(); range.selectNodeContents(n)
        for (const r of range.getClientRects()) if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2) return true
      }
      return false
    }
    // painted = something drawn: a background, a border or a shadow (a plain layout box is not)
    const styles = new Map()
    const painted = el => {
      let v = styles.get(el)
      if (v === undefined) {
        const cs = getComputedStyle(el)
        const alpha = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c === 'transparent' ? 0 : 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1 }
        v = alpha(cs.backgroundColor) > 0.05 || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none'
          || ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(cs[`border${k}Width`]) > 0 && alpha(cs[`border${k}Color`]) > 0.05)
        styles.set(el, v)
      }
      return v
    }
    const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height }
    const hit = (x, y, own, r) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return 0
      const el = document.elementFromPoint(x, y)
      if (!el) return 0
      if (el.closest(GRAPHIC) || overText(el, x, y)) return 1
      const o = own.find(o => o === el || o.contains(el))
      if (o) {
        // inside its own target: only its empty space is free (not its text, icons, or anything drawn in it,
        // except a box that fills the whole target)
        const ob = o.getBoundingClientRect()
        for (let e = el; e && e !== o; e = e.parentElement) {
          const b = e.getBoundingClientRect()
          if (painted(e) && !(b.width >= ob.width * 0.85 && b.height >= ob.height * 0.85)) return 1
        }
        return 0
      }
      const ia = el.closest(INTERACTIVE)
      if (ia && !own.some(o => ia.contains(o))) return 1
      // elsewhere: small drawn things (chips, pills, coloured boxes, dots) count, large surfaces (cards) do not
      const small = (6 * r) * (6 * r) * 4
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        if (own.some(o => e.contains(o))) break
        if (painted(e) && area(e) < small) return 1
      }
      return 0
    }
    const ring = [[0, 0]]
    for (let i = 0; i < 8; i++) ring.push([Math.cos(i * Math.PI / 4) * 0.85, Math.sin(i * Math.PI / 4) * 0.85])
    for (let i = 0; i < 4; i++) ring.push([Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.45, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.45])
    // a marker that sits nearer to another control or card than to its own target reads as pointing to that one
    const near = []
    const vw = innerWidth * innerHeight
    for (const e of document.querySelectorAll(`${INTERACTIVE}, [role="option"], [role="row"], .card, tr, .chip`)) {
      const b = e.getBoundingClientRect()
      if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight || b.width * b.height > vw * 0.25) continue
      near.push({ e, b })
    }
    const dist = (x, y, b) => Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom))
    const ambiguous = (c, own) => {
      if (!own.length) return false
      const mine = Math.min(...own.map(o => dist(c.x, c.y, o.getBoundingClientRect())))
      return near.some(({ e, b }) => !own.some(o => o === e || o.contains(e) || e.contains(o)) && dist(c.x, c.y, b) < mine + 4)
    }
    return cands.map(c => ring.reduce((n, [dx, dy]) => n + hit(c.x + dx * c.r, c.y + dy * c.r, owns[c.m] || [], c.r), 0) + (ambiguous(c, owns[c.m] || []) ? 4 : 0))
  }, { cands, owns })
}

/**
 * Where each marker goes: its own `place` when given; else, among the places of placeOrder() (beside the target on
 * the reading side first), the first one that lies inside the picture, touches no marker already placed nor another
 * marker's target (one that contains this target does not count) and covers nothing (coverScores); failing that, the
 * first that covers nothing while touching another target; failing that, the one covering the least, pulled inside
 * the picture.
 */
async function layoutMarkers(page, items, area, d, rtl) {
  const margin = 3
  const inner = { x: area.x + margin, y: area.y + margin, width: area.width - 2 * margin, height: area.height - 2 * margin }
  const rectAt = c => ({ x: c.x - d / 2, y: c.y - d / 2, width: d, height: d })
  const clampIn = c => ({ x: Math.max(inner.x + d / 2, Math.min(inner.x + inner.width - d / 2, c.x)), y: Math.max(inner.y + d / 2, Math.min(inner.y + inner.height - d / 2, c.y)) })
  const content = await contentBoxes(page, items.map(m => m.handles || []))
  const cands = []
  items.forEach((m, i) => {
    const shown = content[i]
    // 'after-content' only when the target has room beside what it shows (or when asked for)
    const room = m.place === 'after-content' ? shown : shown && shown.width < m.box.width * 0.75 ? shown : null
    m.cands = (m.place ? [m.place] : placeOrder(m.box, area, d)).map(place => {
      const raw = placeCentre(place, m.box, d, rtl, room)
      if (!raw) return null
      raw.x += (rtl ? -1 : 1) * (m.dx || 0); raw.y += m.dy || 0
      const at = clampIn(raw)
      const cand = { place, x: at.x, y: at.y, clamped: Math.hypot(at.x - raw.x, at.y - raw.y) > 1, m: i, r: d / 2 }
      cands.push(cand)
      return cand
    }).filter(Boolean)
    if (!m.cands.length) throw new Error(`marker ${m.n}: place '${m.place}' does not apply to its target (it shows no text or icon)`)
  })
  const scores = await coverScores(page, cands.map(({ x, y, r, m }) => ({ x, y, r, m })), items.map(m => m.handles || []))
  cands.forEach((c, i) => { c.score = scores[i] })
  const placed = []
  for (const m of items) {
    const others = items.filter(o => o !== m && !contains(o.box, m.box)).map(o => o.box)
    const free = c => !placed.some(q => overlaps(q, rectAt(c), 4))
    const cost = c => c.score + (c.clamped ? 2 : 0) + (others.some(o => depth(o, rectAt(c)) > d * 0.25) ? 2 : 0)
    const best = m.place ? m.cands[0]
      : m.cands.find(c => !c.clamped && free(c) && c.score === 0 && !others.some(o => depth(o, rectAt(c)) > d * 0.25))
      || m.cands.find(c => !c.clamped && free(c) && c.score === 0)
      || [...m.cands].filter(free).sort((a, b) => cost(a) - cost(b))[0]
      || m.cands[0]
    m.centre = { x: best.x, y: best.y }
    m.chosen = best.place
    if (process.env.GUIDE_DEBUG) console.log(`  marker ${m.n}: box ${[m.box.x, m.box.y, m.box.width, m.box.height].map(Math.round).join(',')} → ${best.place}  [${m.cands.map(c => `${c.place}:${c.score}${c.clamped ? 'c' : ''}${free(c) ? '' : 'm'}${others.some(o => depth(o, rectAt(c)) > d * 0.25) ? 'o' : ''}`).join(' ')}]`)
    placed.push(rectAt(m.centre))
  }
  return items
}

/** Element handles of a target (every visible match), for coverScores(); none for boxes and points. */
async function handlesOf(page, target) {
  if (target == null || isBoxLike(target)) return []
  if (Array.isArray(target)) return (await Promise.all(target.map(t => handlesOf(page, t)))).flat()
  const loc = typeof target === 'string' ? page.locator(target) : target
  const hs = await loc.elementHandles().catch(() => [])
  const out = []
  for (const h of hs) { if (await h.isVisible().catch(() => false)) out.push(h); else await h.dispose().catch(() => {}) }
  return out
}

/** Draws the markers and outlines (window coordinates) in a fixed layer above everything, pointer-events none. */
async function drawOverlay(page, { markers, highlights, d, line }) {
  await page.evaluate(({ id, markers, highlights, d, line, brand }) => {
    document.getElementById(id)?.remove()
    const layer = document.createElement('div')
    layer.id = id
    layer.setAttribute('aria-hidden', 'true')
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:visible;contain:layout'
    for (const h of highlights) {
      const el = document.createElement('div')
      el.style.cssText = `position:absolute;box-sizing:border-box;left:${h.x}px;top:${h.y}px;width:${h.width}px;height:${h.height}px;`
        + `border:${line}px solid ${brand};border-radius:${h.radius}px;`
        + `box-shadow:0 0 0 ${line * 1.4}px rgba(14,143,134,.16),0 0 ${line * 6}px rgba(14,143,134,.38),inset 0 0 ${line * 3}px rgba(14,143,134,.12)`
      layer.appendChild(el)
    }
    const ring = Math.max(2, Math.round(d * 0.085))
    for (const m of markers) {
      const el = document.createElement('div')
      el.textContent = String(m.n)
      const two = String(m.n).length > 1
      el.style.cssText = `position:absolute;box-sizing:border-box;left:${m.x - d / 2}px;top:${m.y - d / 2}px;width:${d}px;height:${d}px;`
        + `border-radius:50%;background:${brand};color:#fff;border:${ring}px solid #fff;`
        + 'display:flex;align-items:center;justify-content:center;direction:ltr;'
        + `font:700 ${Math.round(d * (two ? 0.42 : 0.5))}px/1 "Inter Variable","Inter","Segoe UI",system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:0;`
        + `box-shadow:0 ${Math.max(1, d * 0.06)}px ${d * 0.28}px rgba(15,23,42,.30),0 0 0 1px rgba(15,23,42,.10)`
      layer.appendChild(el)
    }
    document.documentElement.appendChild(layer)
  }, { id: OVERLAY_ID, markers: markers.map(m => ({ n: m.n, x: m.centre.x, y: m.centre.y })), highlights, d, line, brand: BRAND })
}
export async function removeOverlay(page) {
  await page.evaluate(id => document.getElementById(id)?.remove(), OVERLAY_ID).catch(() => {})
}

/**
 * Captures what a shot's Target asks (see guide-shots.mjs) into a PNG at the device's pixel density:
 * - the area: the window; an element or several (`el`, union) with `pad` CSS px around it; or a `clip` box;
 * - an element area that does not fit the window grows the window's height for the capture (dialogs and tall cards
 *   then show whole); one out of view is scrolled into view below the top bar;
 * - then the outlines and the numbered markers are drawn in the page, the picture taken, and the overlay removed.
 * Returns { png: Buffer, css: { width, height }, radius (CSS px of rounded corners to cut, 0: none), placed }.
 */
export async function captureTarget(page, deviceName, target, { rtl }) {
  const t = target || {}
  const vp0 = page.viewportSize()
  let grown = false
  let roundRadius = 0
  try {
    let area
    if (t.clip) {
      area = { ...t.clip }
    } else if (t.el != null) {
      const pad = t.pad ?? 16
      const elFirst = Array.isArray(t.el) ? t.el[0] : t.el
      // an element taken without a margin keeps its rounded corners (the page behind them is made transparent)
      if (typeof t.round === 'number') roundRadius = t.round
      else if (t.round ?? pad <= 1) roundRadius = Math.max(0, ((await radiusOf(page, elFirst)) ?? 0) - Math.max(0, pad))
      const measure = async () => {
        const b = await boxOf(page, t.el)
        if (!b) throw new Error('the capture element (el) is not on the page or not visible')
        return { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad }
      }
      area = await measure()
      const chrome = await chromeOf(page, elFirst)
      const topLimit = chrome.layered ? 0 : chrome.top
      const bottomLimit = () => page.viewportSize().height - (chrome.layered ? 0 : chrome.bottom)
      // taller than the room on screen: grow the window for this capture
      if (t.grow !== false && area.height > bottomLimit() - topLimit) {
        const need = Math.ceil(area.height + topLimit + (chrome.layered ? 0 : chrome.bottom) + 24)
        await page.setViewportSize({ width: vp0.width, height: Math.min(need, 6000) })
        grown = true
        await page.waitForTimeout(350)
        area = await measure()
      }
      // out of view: bring it in (inner scrollers first, then the window, keeping clear of the top bar)
      if (area.y < topLimit || area.y + area.height > bottomLimit()) {
        if (typeof elFirst !== 'string' && !isBoxLike(elFirst)) await elFirst.first?.().scrollIntoViewIfNeeded().catch(() => {})
        else if (typeof elFirst === 'string') await page.locator(elFirst).first().scrollIntoViewIfNeeded().catch(() => {})
        area = await measure()
        let delta = 0
        if (area.y < topLimit) delta = area.y - topLimit - 8
        else if (area.y + area.height > bottomLimit()) delta = Math.min(area.y - topLimit - 8, area.y + area.height - bottomLimit() + 8)
        if (delta) {
          const y = await page.evaluate(() => window.scrollY)
          await scrollAndHold(page, Math.max(0, y + delta))
          area = await measure()
        }
      }
    } else {
      const vp = page.viewportSize()
      area = { x: 0, y: 0, width: vp.width, height: vp.height }
    }
    // never outside the window
    const vp = page.viewportSize()
    const x1 = Math.max(0, Math.floor(area.x)), y1 = Math.max(0, Math.floor(area.y))
    const x2 = Math.min(vp.width, Math.ceil(area.x + area.width)), y2 = Math.min(vp.height, Math.ceil(area.y + area.height))
    if (x2 - x1 < 8 || y2 - y1 < 8) throw new Error(`the capture area is empty or off screen (${JSON.stringify(area)})`)
    area = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }

    const { marker: d, line } = overlayScale(deviceName, area.width)
    // outlines: `highlights` and markers with highlight: true
    const hl = []
    for (const h of [...(t.highlights || []), ...(t.markers || []).filter(m => m.highlight).map(m => ({ target: m.target, pad: m.highlightPad }))]) {
      const spec = (h && typeof h === 'object' && 'target' in h) ? h : { target: h }
      const b = await boxOf(page, spec.target)
      if (!b) throw new Error(`highlight target not found: ${describe(spec.target)}`)
      const pad = spec.pad ?? 4
      const r = spec.radius ?? (((await radiusOf(page, spec.target)) ?? 8) + pad)
      hl.push({ x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad, radius: Math.min(r, (b.height + 2 * pad) / 2) })
    }
    const items = []
    try {
      for (const m of t.markers || []) {
        if (m.n == null) throw new Error('a marker needs n (its number)')
        if (m.place && !PLACES.includes(m.place)) throw new Error(`marker ${m.n}: unknown place '${m.place}' (one of: ${PLACES.join(', ')})`)
        const b = await boxOf(page, m.target)
        if (!b) throw new Error(`marker ${m.n}: target not found or not visible: ${describe(m.target)}`)
        items.push({ n: m.n, box: b, place: m.place, dx: m.dx, dy: m.dy, handles: await handlesOf(page, m.target) })
      }
      await layoutMarkers(page, items, area, d, rtl)
    } finally {
      for (const m of items) for (const h of m.handles || []) await h.dispose().catch(() => {})
    }
    if (items.length || hl.length) await drawOverlay(page, { markers: items, highlights: hl, d, line })
    await page.waitForTimeout(80)
    const png = await page.screenshot({ clip: area, animations: 'disabled', caret: 'hide', scale: 'device' })
    return { png, css: { width: area.width, height: area.height }, radius: roundRadius, placed: items.map(m => `${m.n}:${m.chosen}`) }
  } finally {
    await removeOverlay(page)
    if (grown) await page.setViewportSize(vp0).catch(() => {})
  }
}
function describe(t) {
  if (t == null) return String(t)
  if (typeof t === 'string') return t
  if (Array.isArray(t)) return `[${t.map(describe).join(', ')}]`
  if (isBoxLike(t)) return JSON.stringify(t)
  return String(t)
}

// ---- WebP files --------------------------------------------------------------------------------------------------
// sharp when dental/node_modules has it, else Python's PIL (python3 -c "import PIL"): each picture is written at
// the device's widths (never wider than the capture), WebP quality 80, lowered step by step (not below 60) while the
// largest file is over MAX_BYTES. Encoder effort is the highest for opaque pictures and one lower for pictures with
// transparent rounded corners (the highest takes ten times longer with an alpha channel for about 2% less).

export const QUALITY = 80
export const MAX_BYTES = 180 * 1024
let sharpMod
async function getSharp() {
  if (sharpMod !== undefined) return sharpMod
  try { sharpMod = createRequire(path.join(ROOT, 'package.json'))('sharp') } catch { sharpMod = null }
  return sharpMod
}
const PY = `
import sys, json, io
from PIL import Image, ImageDraw
a = json.loads(sys.argv[1])
im = Image.open(a['src']); im.load()
im = im.convert('RGB')
R = min(int(round(a.get('radius') or 0)), im.width // 2, im.height // 2)
if R > 0:
    s = 4
    big = Image.new('L', (R * s, R * s), 0)
    ImageDraw.Draw(big).pieslice((0, 0, 2 * R * s - 1, 2 * R * s - 1), 180, 270, fill=255)
    c = big.resize((R, R), Image.LANCZOS)
    mask = Image.new('L', im.size, 255)
    mask.paste(c, (0, 0)); mask.paste(c.transpose(Image.FLIP_LEFT_RIGHT), (im.width - R, 0))
    mask.paste(c.transpose(Image.FLIP_TOP_BOTTOM), (0, im.height - R)); mask.paste(c.transpose(Image.ROTATE_180), (im.width - R, im.height - R))
    im.putalpha(mask)
out = []
for w in a['widths']:
    img = im if w >= im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    q = a['quality']
    while True:
        buf = io.BytesIO(); img.save(buf, 'WEBP', quality=q, method=4 if R > 0 else 6)
        if buf.tell() <= a['maxBytes'] or q <= a['minQuality'] or w != a['widths'][0]: break
        q -= 6
    if w == a['widths'][0]: a['quality'] = q
    with open(a['dest'] % w, 'wb') as f: f.write(buf.getvalue())
    out.append({'width': img.width, 'height': img.height, 'bytes': buf.tell(), 'quality': q})
print(json.dumps(out))
`
/** The widths to make of a capture `pxWidth` device px wide: the device's widths, none wider than the capture. */
export function widthsFor(deviceName, pxWidth) {
  return [...new Set(DEVICES[deviceName].widths.map(w => Math.min(w, pxWidth)))].sort((a, b) => b - a)
}
/**
 * Writes `${destBase}-<width>.webp` for each width (largest first); `radius` (px of the PNG) cuts rounded corners
 * (transparent). Returns [{ width, height, bytes, quality }].
 */
export async function encodeWebp(pngFile, destBase, widths, { radius = 0 } = {}) {
  const sharp = await getSharp()
  if (sharp) {
    const out = []
    let q = QUALITY
    let src = await sharp(pngFile).removeAlpha().png().toBuffer()
    if (radius > 0) {
      const { width, height } = await sharp(src).metadata()
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></svg>`)
      src = await sharp(src).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
    }
    for (const [i, w] of widths.entries()) {
      for (;;) {
        const { data, info } = await sharp(src).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' }).webp({ quality: q, effort: radius > 0 ? 4 : 6 }).toBuffer({ resolveWithObject: true })
        if (i > 0 || data.length <= MAX_BYTES || q <= 60) { fs.writeFileSync(`${destBase}-${w}.webp`, data); out.push({ width: info.width, height: info.height, bytes: data.length, quality: q }); break }
        q -= 6
      }
    }
    return out
  }
  const args = JSON.stringify({ src: pngFile, dest: `${destBase}-%d.webp`, widths, quality: QUALITY, minQuality: 60, maxBytes: MAX_BYTES, radius })
  const stdout = await new Promise((resolve, reject) => execFile('python3', ['-I', '-c', PY, args], { maxBuffer: 1 << 20 }, (e, so, se) => e ? reject(new Error(`WebP encoding failed: ${se || e.message}`)) : resolve(so)))
  return JSON.parse(stdout)
}
export async function encoderName() { return (await getSharp()) ? 'sharp' : 'python3 PIL' }

// ---- ctx.helpers -------------------------------------------------------------------------------------------------

/**
 * The helpers a shot gets as ctx.helpers (all async unless noted). `lane` is the runner's state of this page.
 *
 *   pick(ar, en)                  (sync) the Arabic or the English value, by the shot's language
 *   t(key, params?)               the app's own text, exactly as it shows it in this language: t('patients.newPatient')
 *   goto(route, { wait })         opens a hash route ('/patients', '/settings/backup'), waits until it has loaded and
 *                                 settled (wait: extra ms, default 600) and holds the window at the top
 *   settle(ms)                    waits for the network, fonts, spinners and skeletons, then ms more
 *   scrollTo(target, { offset, align })  scrolls the window so `target` sits just under the top bar (offset: CSS px,
 *                                 negative leaves that much above it in view) or, with align 'bottom', its bottom just
 *                                 above the window's bottom edge / the phone's bottom bar; holds the position
 *   scrollTop()                   back to the top of the screen
 *   card(title)                   (sync) locator of the innermost .card with a title (.card-title, .st-section-title,
 *                                 h2-h4) containing `title` (a string or RegExp): card(await t('settings.pref.font'))
 *   dialog()                      (sync) locator of the open dialog or drawer (the last one)
 *   db(fn, arg?)                  runs fn(db, arg) in the page with the app's Dexie database, returns its result:
 *                                 db(async (db, name) => (await db.patients.where('name').equals(name).first())?.id, 'x')
 *   patient(query)                the first active demo patient whose name contains `query` (or whose file number is
 *                                 it): { id, name, fileNo }; throws when there is none
 *   ids()                         demo records picked as store/scripts/shoot.mjs picks them: { alert, alertShort, chart,
 *                                 plan, inv } (patient ids with the fullest medical alert, the most varied chart, an
 *                                 open plan with mixed statuses; a part-paid invoice id)
 *   storage(entries, { reload })  sets (string) or removes (null) localStorage keys, then reloads the page (default
 *                                 true) so the app reads them; the runner puts localStorage back after the shot
 *   css(text)                     adds a style sheet to the page for this shot (e.g. hide a toast); gone after it
 *   noToasts()                    hides toasts (the app's .toast-stack) for this shot
 *   signOut() / lock()            Sign out / Lock screen from the user menu (desktop: the sidebar's user card; phone:
 *                                 More), as a user does: the sign-in screen opens; the next shot is signed in again
 *   signIn(userId?)               signs `userId` (default the admin; 'u-doc2' doctor, 'u-rec' receptionist) in and
 *                                 reloads; the next shot is the admin again
 *   pin()                         (sync) the demo team's PIN, '1234'
 *   team                          (sync) { 'u-admin': { ar, en, role }, ... } the demo team's names
 *   viewport(size)                changes the window size for this shot ({ width, height }); restored after it
 *   changedData()                 tells the runner this shot changed data in a way it might not see, so the database
 *                                 is restored before the next shot (it already compares every table after each shot)
 *   now                           (sync) the fixed clock, a Date
 *   wait(ms)                      plain pause
 */
export function makeHelpers(page, lane, shotState) {
  const lang = lane.lang
  const h = {
    lang, device: lane.device, now: NOW, team: TEAM,
    pick: (ar, en) => (lang === 'ar' ? ar : en),
    pin: () => PIN,
    t: (key, params) => translate(lang, key, params),
    wait: ms => page.waitForTimeout(ms),
    settle: (ms = 500) => settle(page, ms),
    async goto(route, { wait = 600 } = {}) {
      const r = route.startsWith('#') ? route.slice(1) : route
      await page.goto(`${APP}#${r.startsWith('/') ? r : '/' + r}`)
      await settle(page, 0)
      await scrollAndHold(page, 0)
      await settle(page, wait)
    },
    scrollTop: () => scrollAndHold(page, 0),
    async scrollTo(target, { offset = 0, align = 'top' } = {}) {
      const loc = typeof target === 'string' ? page.locator(target).first() : target.first ? target.first() : target
      await loc.waitFor({ state: 'visible', timeout: 10000 })
      const top = await loc.evaluate((el, [offset, align]) => {
        const r = el.getBoundingClientRect()
        const vis = e => e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0
        const nav = document.querySelector('.app-bottomnav')
        const navH = vis(nav) ? nav.getBoundingClientRect().height : 0
        if (align === 'bottom') return Math.max(0, Math.round(r.bottom + window.scrollY - (window.innerHeight - navH) + 16 + offset))
        const bar = document.querySelector('.app-topbar')
        const barH = vis(bar) ? bar.getBoundingClientRect().height : 0
        return Math.max(0, Math.round(r.top + window.scrollY - barH - 12 + offset))
      }, [offset, align])
      await scrollAndHold(page, top)
      await page.waitForTimeout(200)
    },
    card(title) {
      return page.locator('.card').filter({ has: page.locator('.card-title, .st-section-title, h2, h3, h4').filter({ hasText: title }) }).last()
    },
    dialog: () => page.locator('[role="dialog"]').last(),
    db: (fn, arg) => page.evaluate(`(${fn.toString()})(window.__dentora.db, ${JSON.stringify(arg ?? null)})`),
    async patient(query) {
      const p = await page.evaluate(async q => {
        const all = (await window.__dentora.db.patients.toArray()).filter(p => !p.archived)
        const norm = s => String(s || '').toLowerCase()
        return all.find(p => String(p.fileNo) === String(q)) || all.find(p => norm(p.name).includes(norm(q))) || null
      }, query)
      if (!p) throw new Error(`no demo patient matches '${query}'`)
      return { id: p.id, name: p.name, fileNo: p.fileNo }
    },
    ids: () => pickIds(page),
    async storage(entries, { reload = true } = {}) {
      await page.evaluate(e => { for (const [k, v] of Object.entries(e)) { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)) } }, entries)
      if (reload) { await page.reload(); await settle(page, 400) }
    },
    css: text => page.addStyleTag({ content: text }).then(() => undefined),
    noToasts: () => page.addStyleTag({ content: '.toast-stack{display:none!important}' }).then(() => undefined),
    signOut: () => userMenu(page, lang, 'nav.logout'),
    lock: () => userMenu(page, lang, 'nav.lock'),
    async signIn(userId = ADMIN_ID) {
      await page.evaluate(id => { window.name = `dentora-qa-session:${id}` }, userId)
      await page.reload(); await settle(page, 500)
    },
    async viewport(size) { await page.setViewportSize(size); await page.waitForTimeout(250) },
    changedData() { shotState.dirty = true },
  }
  return h
}

/** Chooses `key` ('nav.lock' or 'nav.logout') in the user menu (desktop: the sidebar's user card; phone: More). */
async function userMenu(page, lang, key) {
  const label = await translate(lang, key)
  const card = page.locator('.sidebar-user')
  if (await card.isVisible().catch(() => false)) {
    await card.click()
    await page.getByRole('menuitem', { name: label }).click()
  } else {
    await page.locator('.app-bottomnav .bn-item').last().click()
    await page.locator('.more-user').getByRole('button', { name: label }).click()
  }
  await page.waitForURL(/#\/login/, { timeout: 10000 }).catch(() => {})
  await settle(page, 500)
}

/** shoot.mjs's pickIds(): which demo records show the most in a picture (the demo data is fixed, its ids are not). */
export async function pickIds(page) {
  return page.evaluate(async (NOW_ISO) => {
    const db = window.__dentora.db
    const patients = (await db.patients.toArray()).filter(p => !p.archived)
    const teeth = (await db.teeth.toArray()).filter(t => t.active !== false)
    const items = await db.treatments.toArray()
    const plans = await db.plans.toArray()
    const best = (score) => patients.map(p => [p, score(p)]).sort((a, b) => b[1] - a[1])[0]?.[0]
    const alert = best(p => (p.allergies?.length ? 100 : 0) + (p.chronicDiseases?.length || 0) * 10 + (p.medications?.length || 0) * 10)
    const upcoming = new Set((await db.appointments.toArray()).filter(a => a.start > NOW_ISO && a.status !== 'cancelled').map(a => a.patientId))
    const alertShort = best(p => (p.allergies?.length ? 100 : 0) - ((p.chronicDiseases?.length || 0) + (p.medications?.length || 0)) * 50 + (upcoming.has(p.id) ? 10 : 0) - (p.tags?.length ? 20 : 0))
    const DULL = ['missing', 'attrition', 'other', 'impacted']
    const adult = p => !p.birthDate || Number(NOW_ISO.slice(0, 4)) - Number(p.birthDate.slice(0, 4)) >= 18
    const chart = best(p => {
      if (!adult(p)) return -1e9
      const mine = teeth.filter(t => t.patientId === p.id)
      const vivid = mine.filter(t => !DULL.includes(t.condition))
      const missing = mine.filter(t => t.condition === 'missing').length
      return new Set(vivid.map(t => t.condition)).size * 2 + new Set(vivid.map(t => t.tooth)).size - missing * 2
    })
    const plan = best(p => Math.max(0, ...plans.filter(x => x.patientId === p.id && x.status === 'in_progress').map(x => {
      const its = items.filter(i => i.planId === x.id)
      return new Set(its.map(i => i.status)).size * 10 + its.length
    })))
    const invoices = await db.invoices.toArray()
    const lines = i => i.items?.length || 0
    const inv = invoices.filter(i => i.status === 'partial' && lines(i) >= 2).sort((a, b) => b.total - a.total)[0]
      || invoices.filter(i => i.status === 'paid' && lines(i) >= 3).sort((a, b) => b.total - a.total)[0]
    return { alert: alert?.id, alertShort: alertShort?.id, chart: chart?.id, plan: plan?.id, inv: inv?.id }
  }, NOW.toISOString())
}

/** Raw captures, failure pictures and preview.html: $GUIDE_WORK, or a folder of this QA_PORT (people shoot side by side). */
export const tmpDir = () => process.env.GUIDE_WORK || path.join(os.tmpdir(), `dentora-guide-shots-${PORT}`)
export { sleep }
