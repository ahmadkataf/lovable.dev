// Store screenshots of the real app with the demo clinic loaded (Google Play phone and tablet sizes, and desktop
// pictures for the Windows / website pages). It needs a QA build (one with window.__dentora), served on its own port:
//   VITE_QA=1 npx vite build --outDir /tmp/dist-store
//   QA_DIST=/tmp/dist-store QA_PORT=4790 node store/scripts/shoot.mjs [--devices=phone,tablet7,tablet10,desktop] [--langs=ar,en]
// Output (every PNG is exactly the size Play or the Microsoft Store expects, sharp through deviceScaleFactor):
//   store/screenshots/<device>/<lang>/NN-<screen>.png        raw screenshots, ready to upload as they are
//   $STORE_WORK/<device>-tall/<lang>/NN-<screen>.png          taller phone captures used inside the framed versions
// The clinic is the app's own demo clinic, loaded through Settings → Backup → "Load demo data" as a clinic does.
// The clock is fixed to a weekday late morning in Damascus so the day view and the dashboard look like a working day,
// and the pictures are the same at every run. The trial bar is hidden: the pictures show an activated copy.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, seedAndLogin, loadDemo, requireQaHandle, BASE, DIST, NO_QA_HANDLE } from '../../scripts/qa/lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'store/screenshots')
const WORK = process.env.STORE_WORK || '/tmp/dentora-store-work'
const arg = (name, def) => (process.argv.find(a => a.startsWith(`--${name}=`)) || `--${name}=${def}`).split('=')[1].split(',').filter(Boolean)
const DEVICE_NAMES = arg('devices', 'phone,tablet7,tablet10,desktop')
const LANGS = arg('langs', 'ar,en')
const ONLY = arg('screens', '')
const FULL = process.argv.includes('--full')     // also full-page captures in $STORE_WORK/full (to choose scroll targets)
// Sunday 11 October 2026, 11:40 in Damascus: a working day (the demo clinic works Saturday to Thursday)
const NOW = new Date(process.env.STORE_NOW || '2026-10-11T11:40:00+03:00')

/**
 * Play: phone 9:16 (1080×1920); 7-inch tablet in portrait, 9:16 (1080×1920 from a 675×1200 screen); 10-inch tablet in
 * landscape, 16:9 (2560×1440): the Play Console asks tablet screenshots in 16:9 or 9:16. A 7-inch screen in landscape
 * is too short for these screens. Desktop 16:9 at 3200×1800 fits the Microsoft Store (≤ 3840×2160) and a website.
 * The phone also gets a taller 19.5:9 capture for the framed pictures.
 */
const DEVICES = {
  phone: { viewport: { width: 405, height: 720 }, scale: 8 / 3, mobile: true, tall: { width: 405, height: 878 } },
  tablet7: { viewport: { width: 675, height: 1200 }, scale: 1.6, mobile: true, storage: { 'dentora.chart.zoom': '0' } },
  tablet10: { viewport: { width: 1280, height: 720 }, scale: 2, mobile: true },
  desktop: { viewport: { width: 1600, height: 900 }, scale: 2, mobile: false },
}

/**
 * The screens, in store order. A screen opens at its top; `scroll[device]` = [selector, offset, align] scrolls that
 * element to just under the top bar first (offset in CSS px, negative = leave that much of what is above it in view),
 * or with align 'bottom' brings its bottom edge just above the bottom navigation.
 */
const SCREENS = [
  { key: 'dashboard', route: () => '/' },
  { key: 'patient', route: (ids, device) => `/patients/${device === 'phone' ? ids.alertShort : ids.alert}`, scroll: { phone: ['.pt-alert', 0, 'bottom'] } },
  { key: 'chart', route: ids => `/patients/${ids.chart}?tab=chart`, scroll: { phone: ['.ch-card', 0], tablet7: ['.pt-tabs', -6], tablet10: ['.ch-card', 0, 'bottom'], desktop: ['.pt-tabs', -6] } },
  { key: 'appointments', route: () => '/appointments?view=day' },
  { key: 'treatments', route: ids => `/patients/${ids.plan}?tab=treatments`, scroll: { phone: ['.tr-plan', 0], tablet7: ['.pt-tabs', -6], tablet10: ['.pt-tabs', -6], desktop: ['.pt-tabs', -6] } },
  { key: 'invoice', route: ids => `/invoices/${ids.inv}` },
  { key: 'reports', route: () => '/reports', scroll: { phone: ['[data-testid="chart-revenue"]', -4] } },
]

async function newContext(browser, device, lang, viewport = device.viewport) {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: device.scale, isMobile: device.mobile, hasTouch: device.mobile,
    locale: lang === 'ar' ? 'ar-SY' : 'en-US', timezoneId: 'Asia/Damascus',
  })
  // the pictures show an activated copy: no trial bar
  await ctx.addInitScript(() => {
    const css = '[data-qa="trial-bar"]{display:none!important}'
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s) }
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add)
  })
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'}`)))
  // reports open on last month (a daily chart over a whole month, not the first days of this one)
  await ctx.addInitScript(() => {
    try { if (!localStorage.getItem('dentora.reports.preset')) localStorage.setItem('dentora.reports.preset', 'lastMonth') } catch { /* ignore */ }
  })
  // per-device preferences (the 7-inch chart shows the whole mouth: it fits that screen)
  if (device.storage) await ctx.addInitScript(entries => { try { for (const [k, v] of Object.entries(entries)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v) } catch { /* ignore */ } }, device.storage)
  const page = await ctx.newPage()
  await page.clock.install({ time: NOW })
  return { ctx, page }
}

/**
 * Which demo records to show (the demo data is deterministic, but its ids are not):
 * - alert: the patient with the fullest medical alert (allergy, chronic disease, medication);
 * - chart: the patient with the most varied chart (kinds of finding, few missing teeth);
 * - plan: the patient whose open treatment plan mixes done, in-progress and planned work;
 * - inv: a part-paid invoice with several lines (the largest), else the largest paid one.
 */
async function pickIds(page) {
  return page.evaluate(async (NOW_ISO) => {
    const db = window.__dentora.db
    const patients = (await db.patients.toArray()).filter(p => !p.archived)
    const teeth = (await db.teeth.toArray()).filter(t => t.active !== false)
    const items = await db.treatments.toArray()
    const plans = await db.plans.toArray()
    const best = (score) => patients.map(p => [p, score(p)]).sort((a, b) => b[1] - a[1])[0]?.[0]
    const alert = best(p => (p.allergies?.length ? 100 : 0) + (p.chronicDiseases?.length || 0) * 10 + (p.medications?.length || 0) * 10)
    // on a phone screen a one-line alert leaves the whole patient card in view
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
    return { alert: alert?.id, alertShort: alertShort?.id, chart: chart?.id, plan: plan?.id, inv: inv?.id, names: [alert?.name, alertShort?.name, chart?.name, plan?.name, inv?.number] }
  }, NOW.toISOString())
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

async function settle(page, ms) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(ms)
}

/** Scrolls the window to `top` and keeps doing so until it stays there (the app may restore an older position). */
async function scrollAndHold(page, top) {
  for (let i = 0; i < 20; i++) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top)
    await page.waitForTimeout(250)
    const now = await page.evaluate(() => window.scrollY)
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    if (Math.abs(now - Math.min(top, Math.max(0, max))) <= 1) return now
  }
  throw new Error(`the page did not stay at scroll position ${top}`)
}

async function capture(page, screen, deviceName, lang, file) {
  // page.goto() reads as Back/Forward to the app, which restores the last position it saw: start from the top
  await scrollAndHold(page, 0)
  const target = screen.scroll?.[`${deviceName}-${lang}`] ?? screen.scroll?.[deviceName]
  if (target) {
    const top = await page.evaluate(([sel, offset, align]) => {
      const el = document.querySelector(sel)
      if (!el) return 0
      const r = el.getBoundingClientRect()
      if (align === 'bottom') {
        // the element's bottom just above the bottom navigation (phones) or the window's bottom edge
        const nav = document.querySelector('.app-bottomnav')
        const navH = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().height : 0
        return Math.max(0, Math.round(r.bottom + window.scrollY - (window.innerHeight - navH) + 16 + offset))
      }
      const bar = document.querySelector('.app-topbar')?.getBoundingClientRect().height || 64
      return Math.max(0, Math.round(r.top + window.scrollY - bar - 12 + offset))
    }, target)
    await scrollAndHold(page, top)
  }
  await page.waitForTimeout(300)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file })
  if (FULL) {
    const full = path.join(WORK, 'full', path.relative(OUT, file).startsWith('..') ? path.basename(path.dirname(path.dirname(file))) + '-' + path.basename(file) : path.relative(OUT, file).replaceAll('/', '-'))
    fs.mkdirSync(path.dirname(full), { recursive: true })
    await page.screenshot({ path: full, fullPage: true })
  }
  console.log('shot', path.relative(ROOT, file).startsWith('..') ? file : path.relative(ROOT, file))
  // leave the screen at its top, so the next page.goto() has nothing to restore
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(150)
}

const server = await startServer()
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
let problems = 0
try {
  for (const lang of LANGS) {
    for (const deviceName of DEVICE_NAMES) {
      const device = DEVICES[deviceName]
      const { ctx, page } = await newContext(browser, device, lang)
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      await page.goto(`${BASE}/index.html#/`)
      if (!(await requireQaHandle(page, 15000).then(() => true, () => false))) throw new Error(NO_QA_HANDLE)
      await seedAndLogin(page, { lang })
      if (lang === 'en') await englishClinic(page)
      await loadDemo(page)
      const counts = await waitForDemo(page)
      await page.waitForTimeout(600)
      await page.reload(); await settle(page, 600)
      const ids = await pickIds(page)
      console.log(lang, deviceName, 'demo:', JSON.stringify(counts), 'picked:', JSON.stringify(ids))
      // a full run replaces the device's pictures (a screen that was dropped does not linger)
      if (!ONLY.length) for (const dir of [path.join(OUT, deviceName, lang), path.join(WORK, `${deviceName}-tall`, lang)]) fs.rmSync(dir, { recursive: true, force: true })
      const sizes = device.tall ? [['', device.viewport], ['tall', device.tall]] : [['', device.viewport]]
      for (const [variant, viewport] of sizes) {
        await page.setViewportSize(viewport)
        for (const [i, screen] of SCREENS.entries()) {
          if (ONLY.length && !ONLY.includes(screen.key)) continue
          await page.goto(`${BASE}/index.html#${screen.route(ids, deviceName)}`)
          await settle(page, screen.key === 'reports' || screen.key === 'dashboard' ? 1600 : 1000)
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
          if (overflow > 1) { problems++; console.log(`OVERFLOW ${lang} ${deviceName} ${screen.key}: +${overflow}px`) }
          const name = `${String(i + 1).padStart(2, '0')}-${screen.key}.png`
          const file = variant ? path.join(WORK, `${deviceName}-${variant}`, lang, name) : path.join(OUT, deviceName, lang, name)
          await capture(page, screen, deviceName, lang, file)
        }
      }
      if (errors.length) { problems++; console.log(`ERRORS ${lang} ${deviceName}:`, [...new Set(errors)].slice(0, 6)) }
      await ctx.close()
    }
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(problems ? `shoot finished with ${problems} problem(s)` : `shoot clean (${DIST})`)
process.exit(problems ? 1 : 0)
