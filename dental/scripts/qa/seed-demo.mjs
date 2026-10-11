// Loads the demo data into the built app in real Chromium through Settings → Data → "Load demo data" (the button the
// clinic uses), checks it through window.__dentora.db and takes screenshots of the main screens with it: desktop Arabic,
// desktop English and a phone (390×844, where no screen may scroll sideways).
//   npx vite build --outDir /tmp/dist-seed
//   QA_DIST=/tmp/dist-seed QA_PORT=4322 QA_SHOTS=qa-shots/seed node scripts/qa/seed-demo.mjs
// If the settings screen has no such button (it is being reworked), the demo module is bundled on its own (IIFE →
// window.DentoraSeed) and injected instead; it opens the same IndexedDB database as the app.
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BASE, openBrowser, seedAndLogin, shot, startServer } from './lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const failures = []
const check = (ok, msg) => { if (!ok) failures.push(msg); console.log(ok ? '  ok  ' : '  FAIL', msg) }

let bundle = null
async function injectedBundle() {
  if (bundle) return bundle
  const { build } = await import('vite')
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-seed-'))
  await build({
    configFile: false, root: ROOT, logLevel: 'warn',
    resolve: { alias: { '@': path.join(ROOT, 'src') } },
    define: { __APP_VERSION__: '"qa"', 'process.env.NODE_ENV': '"production"' },
    build: { outDir: out, emptyOutDir: true, minify: false, lib: { entry: path.join(ROOT, 'src/features/seed/demo.ts'), name: 'DentoraSeed', formats: ['iife'], fileName: () => 'seed.js' } },
  })
  bundle = path.join(out, 'seed.js')
  return bundle
}

const patientCount = page => page.evaluate(() => window.__dentora.db.patients.count())

/** Loads the demo data the way a user does; returns the time from confirming to the data being there. */
async function loadThroughSettings(page, name) {
  await page.goto(`${BASE}/index.html#/settings/backup`)
  const button = page.locator('[data-qa="load-demo"]')
  try { await button.waitFor({ state: 'visible', timeout: 8000 }) } catch { /* no button */ }
  if (!(await button.count()) || !(await button.isEnabled())) {
    console.log('  (no usable "load demo data" button in Settings; injecting the demo module instead)')
    await page.addScriptTag({ path: await injectedBundle() })
    const t = Date.now()
    await page.evaluate(() => window.DentoraSeed.loadDemoData())
    return { ms: Date.now() - t, via: 'bundle' }
  }
  await button.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  if (name) await shot(page, `${name}-settings-confirm`)
  const t = Date.now()
  await dialog.getByRole('button').last().click()
  if (name) { await page.waitForTimeout(150); await shot(page, `${name}-settings-progress`) }
  await page.waitForFunction(async () => (await window.__dentora.db.patients.count()) >= 60 && (await window.__dentora.db.activity.count()) > 50, null, { timeout: 20000, polling: 50 })
  const ms = Date.now() - t
  await page.waitForTimeout(700)
  if (name) await shot(page, `${name}-settings-done`)
  return { ms, via: 'settings' }
}

/** Consistency of what landed in the browser's IndexedDB. */
async function verify(page) {
  return page.evaluate(async () => {
    const db = window.__dentora.db
    const [patients, apts, invoices, payments, items, labs, users] = await Promise.all([db.patients.toArray(), db.appointments.toArray(), db.invoices.toArray(), db.payments.toArray(), db.treatments.toArray(), db.labOrders.toArray(), db.users.toArray()])
    const r2 = n => Math.round(n * 100) / 100
    const bad = []
    const pid = new Set(patients.map(p => p.id)), uid = new Set(users.map(u => u.id))
    for (const a of apts) if (!pid.has(a.patientId) || !uid.has(a.doctorId)) bad.push(`appointment ${a.id} without patient/doctor`)
    const byDoc = {}
    for (const a of apts) (byDoc[a.doctorId] ??= []).push(a)
    for (const list of Object.values(byDoc)) { list.sort((x, y) => x.start.localeCompare(y.start)); for (let i = 1; i < list.length; i++) if (list[i].start < list[i - 1].end) bad.push(`overlap ${list[i].id}`) }
    for (const inv of invoices) {
      const sub = r2(inv.items.reduce((s, i) => s + i.total, 0))
      if (r2(sub - inv.discount + inv.tax) !== inv.total) bad.push(`total ${inv.number}`)
      const paid = r2(payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0))
      if (paid !== inv.paid) bad.push(`paid ${inv.number}`)
    }
    for (const t of items) if (t.invoiceId && !invoices.find(i => i.id === t.invoiceId)?.items.some(l => l.treatmentItemId === t.id)) bad.push(`item ${t.id} not on its invoice`)
    const now = new Date().toISOString()
    for (const a of apts) if (a.createdAt > now) bad.push(`appointment created in the future ${a.id}`)
    const d = new Date(); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      patients: patients.length, appointments: apts.length, today: apts.filter(a => a.date === iso).map(a => a.status), invoices: invoices.length, payments: payments.length,
      labs: [...new Set(labs.map(l => l.status))], bad,
    }
  })
}

/** The patient with the richest chart (for the patient file and chart screenshots). */
const richestPatient = page => page.evaluate(async () => {
  const t = await window.__dentora.db.teeth.toArray(); const n = {}
  for (const r of t) n[r.patientId] = (n[r.patientId] || 0) + 1
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]
})

function watchErrors(page) {
  const errors = []
  page.on('pageerror', e => errors.push(`page: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  return errors
}

const server = await startServer()
try {
  // ---- desktop, Arabic: load through Settings, verify, screenshots
  {
    const { browser, page } = await openBrowser({ lang: 'ar' })
    const errors = watchErrors(page)
    await seedAndLogin(page, { lang: 'ar' })
    const { ms, via } = await loadThroughSettings(page, 'ar')
    console.log(`demo data loaded through ${via} in ${ms} ms`)
    check(ms < 3000, `loads in under 3 s in Chromium (${ms} ms)`)
    check(await patientCount(page) === 60, '60 patients added')
    const v = await verify(page)
    console.log('appointments:', v.appointments, '| invoices:', v.invoices, '| payments:', v.payments, '| today:', v.today.join(' '), '| lab statuses:', v.labs.join(' '))
    check(v.appointments >= 270 && v.appointments <= 330, `~300 appointments (${v.appointments})`)
    check(v.bad.length === 0, `database consistent${v.bad.length ? ': ' + v.bad.slice(0, 5).join('; ') : ''}`)
    // a second load is refused (the button is disabled once there are patients; the function skips)
    await page.goto(`${BASE}/index.html#/settings/backup`)
    await page.waitForTimeout(600)
    const btn = page.locator('[data-qa="load-demo"]')
    check(!(await btn.count()) || !(await btn.isEnabled()), 'the load button is disabled once the clinic has patients')

    const routes = [['/', 'dashboard'], ['/appointments', 'appointments'], ['/patients', 'patients'], ['/treatments', 'treatments'], ['/prescriptions', 'prescriptions'], ['/lab', 'lab'],
      ['/invoices', 'invoices'], ['/payments', 'payments'], ['/expenses', 'expenses'], ['/reports', 'reports'], ['/inventory', 'inventory'], ['/procedures', 'procedures']]
    for (const [route, name] of routes) {
      await page.goto(`${BASE}/index.html#${route}`)
      await page.waitForTimeout(900)
      await shot(page, `ar-${name}`)
    }
    const pid = await richestPatient(page)
    await page.goto(`${BASE}/index.html#/patients/${pid}`)
    await page.waitForTimeout(900)
    await shot(page, 'ar-patient')
    await page.goto(`${BASE}/index.html#/patients/${pid}?tab=chart`)
    await page.waitForTimeout(900)
    await shot(page, 'ar-patient-chart')
    check(errors.length === 0, `no page or console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`)
    await browser.close()
  }
  // ---- desktop English and phone: same data (IndexedDB is per browser profile, so load again)
  for (const [name, opts] of [['en', { lang: 'en' }], ['phone', { lang: 'ar', mobile: true, width: 390, height: 844 }], ['phone-en', { lang: 'en', mobile: true, width: 390, height: 844 }]]) {
    const { browser, page } = await openBrowser(opts)
    const errors = watchErrors(page)
    await seedAndLogin(page, { lang: opts.lang })
    await loadThroughSettings(page, name === 'phone' ? 'phone' : null)
    check(await patientCount(page) === 60, `${name}: 60 patients added`)
    const pid = await richestPatient(page)
    for (const [route, n] of [['/', 'dashboard'], ['/appointments', 'appointments'], ['/patients', 'patients'], ['/invoices', 'invoices'], ['/lab', 'lab'], ['/reports', 'reports'], [`/patients/${pid}`, 'patient'], [`/patients/${pid}?tab=chart`, 'patient-chart']]) {
      await page.goto(`${BASE}/index.html#${route}`)
      await page.waitForTimeout(900)
      await shot(page, `${name}-${n}`)
      if (opts.mobile) {
        const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
        check(w.sw <= w.iw, `${name} ${route}: no sideways scroll (${w.sw} ≤ ${w.iw})`)
      }
    }
    check(errors.length === 0, `${name}: no page or console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`)
    await browser.close()
  }
} finally {
  server.kill()
  if (bundle) fs.rmSync(path.dirname(bundle), { recursive: true, force: true })
}
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1) }
console.log('\nall checks passed')
