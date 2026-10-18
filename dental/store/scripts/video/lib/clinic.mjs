// The clinic on screen: a fresh browser context per chapter and language with the demo clinic loaded the way a
// clinic does (Settings → Backup → "Load demo data"), signed in as the admin, the clock fixed to the same weekday late
// morning as the store screenshots (store/scripts/shoot.mjs), the trial bar hidden (the videos show an activated copy)
// and the overlay of lib/ui.mjs installed. A 1280×720 layout rendered at 1920×1080: the browser is launched with
// --force-device-scale-factor=1.5 (see launchBrowser), which is what makes the screencast frames 1920×1080.
import { chromium } from 'playwright'
import { seedAndLogin, loadDemo, requireQaHandle, BASE, NO_QA_HANDLE } from '../../../../scripts/qa/lib.mjs'
import { installOverlay, overlayConfig } from './ui.mjs'

/** Sunday 11 October 2026, 11:40 in Damascus: a working day (the demo clinic works Saturday to Thursday). */
export const NOW = new Date(process.env.VIDEO_NOW || process.env.STORE_NOW || '2026-10-11T11:40:00+03:00')
export const VIEWPORT = { width: 1280, height: 720 }
export const SCALE = 1.5

/** Chromium with the real device scale the frames need. */
export function launchBrowser() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: [`--force-device-scale-factor=${SCALE}`] })
}

/**
 * A new context and page in `lang` with the overlay, the fixed clock and the hidden trial bar; the page is on the
 * app's setup screen, nothing is signed in yet. `errors` collects the page's console errors for the report.
 */
export async function newClinicPage(browser, lang) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT, deviceScaleFactor: SCALE, isMobile: false, hasTouch: false,
    locale: lang === 'ar' ? 'ar-SY' : 'en-US', timezoneId: 'Asia/Damascus',
  })
  // the videos show an activated copy: no trial bar
  await ctx.addInitScript(() => {
    const css = '[data-qa="trial-bar"]{display:none!important}'
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s) }
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add)
  })
  // reports open on last month (a daily chart over a whole month, not the first days of this one)
  await ctx.addInitScript(() => {
    try { if (!localStorage.getItem('dentora.reports.preset')) localStorage.setItem('dentora.reports.preset', 'lastMonth') } catch { /* ignore */ }
  })
  await ctx.addInitScript(installOverlay, overlayConfig(lang))
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.clock.install({ time: NOW })
  return { ctx, page, errors }
}

/**
 * Signs the admin in and loads the demo clinic on a page from newClinicPage(); an English clinic gets English staff
 * names and address like the store pictures. Resolves with the demo's counts, on the dashboard, settled.
 */
export async function loadClinic(page, lang) {
  await page.goto(`${BASE}/index.html#/`)
  if (!(await requireQaHandle(page, 15000).then(() => true, () => false))) throw new Error(NO_QA_HANDLE)
  await seedAndLogin(page, { lang })
  if (lang === 'en') await englishClinic(page)
  await loadDemo(page)
  const counts = await waitForDemo(page)
  await page.waitForTimeout(600)
  await page.goto(`${BASE}/index.html#/`)
  await page.reload()
  await settle(page, 1200)
  return counts
}

/**
 * seedAndLogin() makes the clinic's team with Arabic names; an English clinic gets English ones (the demo data then
 * reuses Dr. Laila Haddad as it reuses د. ليلى حداد in Arabic) and an English address.
 */
async function englishClinic(page) {
  await page.evaluate(async () => {
    const db = window.__dentora.db
    const names = { 'u-admin': ['Dr. Ahmad Al-Khatib', 'General dentistry'], 'u-doc2': ['Dr. Laila Haddad', 'Orthodontics'], 'u-rec': ['Sara Youssef', undefined] }
    for (const [id, [name, specialty]] of Object.entries(names)) if (await db.users.get(id)) await db.users.update(id, { name, specialty })
    await db.clinic.update('clinic', { name: 'Smile Dental Clinic', nameEn: '', address: 'Al-Jalaa St, Mezzeh, Damascus' })
  })
  await page.reload()
  await page.waitForTimeout(500)
}

/**
 * loadDemo() in scripts/qa/lib.mjs waits with an async predicate, which can return before the data is written on a
 * slower (high-density) page; wait here until the demo clinic is really there and its progress dialog has closed.
 */
async function waitForDemo(page, timeout = 120000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const ok = await page.evaluate(async () => {
      const d = window.__dentora.db
      return (await d.patients.count()) >= 60 && (await d.activity.count()) > 50 && (await d.invoices.count()) > 0 && !document.querySelector('[role="dialog"]')
    })
    if (ok) return page.evaluate(async () => { const d = window.__dentora.db; return { patients: await d.patients.count(), appointments: await d.appointments.count(), invoices: await d.invoices.count() } })
    await page.waitForTimeout(250)
  }
  throw new Error('the demo clinic did not finish loading')
}

/** Network idle, fonts loaded, then `ms` of quiet. */
export async function settle(page, ms) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(ms)
}
