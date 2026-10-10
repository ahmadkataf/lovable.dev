// Loads the demo data into the built app in real Chromium, checks it through window.__dentora.db and takes
// screenshots of the main screens with it (desktop Arabic, desktop English, phone).
//   npx vite build --outDir /tmp/dist-seed
//   QA_DIST=/tmp/dist-seed QA_PORT=4322 QA_SHOTS=qa-shots/seed node scripts/qa/seed-demo.mjs
// The demo generator is not on window, so it is bundled on its own (IIFE → window.DentoraSeed) and injected into the
// page; it opens the same IndexedDB database as the app. The page is reloaded afterwards so every screen reads it.
import { build } from 'vite'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BASE, openBrowser, seedAndLogin, shot, startServer } from './lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-seed-'))
await build({
  configFile: false, root: ROOT, logLevel: 'warn',
  resolve: { alias: { '@': path.join(ROOT, 'src') } },
  define: { __APP_VERSION__: '"qa"', 'process.env.NODE_ENV': '"production"' },
  build: { outDir: out, emptyOutDir: true, minify: false, lib: { entry: path.join(ROOT, 'src/features/seed/demo.ts'), name: 'DentoraSeed', formats: ['iife'], fileName: () => 'seed.js' } },
})
const bundle = path.join(out, 'seed.js')

const failures = []
const check = (ok, msg) => { if (!ok) failures.push(msg); console.log(ok ? '  ok  ' : '  FAIL', msg) }

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
    const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return {
      patients: patients.length, appointments: apts.length, today: apts.filter(a => a.date === iso).map(a => a.status), invoices: invoices.length, payments: payments.length,
      labs: [...new Set(labs.map(l => l.status))], bad,
    }
  })
}

const server = await startServer()
try {
  // ---- desktop, Arabic: load, verify, screenshots
  {
    const { browser, page } = await openBrowser({ lang: 'ar' })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await seedAndLogin(page, { lang: 'ar' })
    await page.addScriptTag({ path: bundle })
    const res = await page.evaluate(async () => {
      const steps = []
      const t = performance.now()
      const counts = await window.DentoraSeed.loadDemoData({ onProgress: s => steps.push(s) })
      return { counts, steps, wall: Math.round(performance.now() - t) }
    })
    console.log('loadDemoData in Chromium:', res.wall, 'ms', JSON.stringify(res.counts))
    check(!res.counts.skipped && res.counts.patients === 60, '60 patients added')
    check(res.counts.appointments >= 270 && res.counts.appointments <= 330, `~300 appointments (${res.counts.appointments})`)
    check(res.wall < 3000, `loads in under 3 s (${res.wall} ms)`)
    check(res.steps.join(',') === 'defaults,staff,patients,schedule,billing,saving,done', 'progress reported for every step')
    const again = await page.evaluate(() => window.DentoraSeed.loadDemoData())
    check(again.skipped === true, 'second load is skipped')
    const v = await verify(page)
    console.log('today:', v.today.join(' '), '| lab statuses:', v.labs.join(' '))
    check(v.bad.length === 0, `database consistent${v.bad.length ? ': ' + v.bad.slice(0, 5).join('; ') : ''}`)

    await page.reload()
    await page.waitForLoadState('networkidle')
    const routes = [['/', 'dashboard'], ['/appointments', 'appointments'], ['/patients', 'patients'], ['/treatments', 'treatments'], ['/prescriptions', 'prescriptions'], ['/lab', 'lab'],
      ['/invoices', 'invoices'], ['/payments', 'payments'], ['/expenses', 'expenses'], ['/reports', 'reports'], ['/inventory', 'inventory'], ['/procedures', 'procedures']]
    for (const [route, name] of routes) {
      await page.goto(`${BASE}/index.html#${route}`)
      await page.waitForTimeout(900)
      await shot(page, `ar-${name}`)
    }
    // the patient with the richest chart
    const pid = await page.evaluate(async () => {
      const t = await window.__dentora.db.teeth.toArray(); const n = {}
      for (const r of t) n[r.patientId] = (n[r.patientId] || 0) + 1
      return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]
    })
    await page.goto(`${BASE}/index.html#/patients/${pid}`)
    await page.waitForTimeout(900)
    await shot(page, 'ar-patient')
    for (const label of ['المخطط السني', 'مخطط الأسنان', 'الأسنان']) {
      const tab = page.getByRole('tab', { name: label })
      if (await tab.count()) { await tab.first().click(); await page.waitForTimeout(700); await shot(page, 'ar-patient-chart'); break }
    }
    check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`)
    await browser.close()
  }
  // ---- desktop English and phone: same data (IndexedDB is per browser profile, so load again)
  for (const [name, opts] of [['en', { lang: 'en' }], ['phone', { lang: 'ar', mobile: true, width: 390, height: 844 }]]) {
    const { browser, page } = await openBrowser(opts)
    await seedAndLogin(page, { lang: opts.lang })
    await page.addScriptTag({ path: bundle })
    await page.evaluate(() => window.DentoraSeed.loadDemoData())
    await page.reload()
    await page.waitForLoadState('networkidle')
    for (const [route, n] of [['/', 'dashboard'], ['/appointments', 'appointments'], ['/patients', 'patients'], ['/invoices', 'invoices']]) {
      await page.goto(`${BASE}/index.html#${route}`)
      await page.waitForTimeout(900)
      await shot(page, `${name}-${n}`)
    }
    await browser.close()
  }
} finally {
  server.kill()
  fs.rmSync(out, { recursive: true, force: true })
}
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1) }
console.log('\nall checks passed')
