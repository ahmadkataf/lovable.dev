// Screenshots every screen of the app in three viewports (desktop Arabic, desktop English, phone 390×844),
// optionally after loading the demo clinic, and reports horizontal overflow, untranslated keys, page errors and
// Content-Security-Policy violations (the build's own index.html policy is in force, as in the shipped apps).
// It needs a QA build (one with window.__dentora):
//   VITE_QA=1 npx vite build --outDir /tmp/dist-tour
//   QA_DIST=/tmp/dist-tour QA_PORT=4420 QA_SHOTS=qa-shots/tour node scripts/qa/tour.mjs [--demo] [--only=desktop-ar,mobile-ar]
import { startServer, openBrowser, seedAndLogin, requireQaHandle, loadDemo, shot, BASE, DIST, NO_QA_HANDLE } from './lib.mjs'

const DEMO = process.argv.includes('--demo')
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean)
const ROUTES = ['/', '/appointments', '/patients', '/treatments', '/prescriptions', '/lab', '/invoices', '/payments', '/expenses', '/reports', '/inventory', '/procedures', '/staff', '/settings', '/settings/preferences', '/settings/backup', '/settings/license']

const server = await startServer()
// a release build has no database handle: refuse at once, with the command that makes a QA build
{
  const { browser, page } = await openBrowser()
  await page.goto(`${BASE}/index.html#/`)
  const ready = await requireQaHandle(page, 15000).then(() => true, () => false)
  await browser.close()
  if (!ready) { server.kill(); console.error(`tour: ${NO_QA_HANDLE}`); process.exit(2) }
}
console.log(`tour of ${DIST}${DEMO ? ' with the demo clinic' : ''}`)
let problems = 0
try {
  const views = [['desktop-ar', { lang: 'ar' }], ['desktop-en', { lang: 'en' }], ['mobile-ar', { lang: 'ar', mobile: true, width: 390, height: 844 }]]
  for (const [name, opts] of views) {
    if (only.length && !only.includes(name)) continue
    const { browser, page } = await openBrowser(opts)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await seedAndLogin(page, { lang: opts.lang })
    const extra = []
    if (DEMO) {
      // through Settings → Backup → "Load demo data", as a clinic does (no script is injected: the CSP stays in force)
      const counts = await loadDemo(page)
      console.log(name, 'demo data:', JSON.stringify(counts))
      await page.reload(); await page.waitForTimeout(800)
      const ids = await page.evaluate(async () => {
        const db = window.__dentora.db
        const teeth = await db.teeth.toArray()
        const counts = new Map(); teeth.forEach(t => counts.set(t.patientId, (counts.get(t.patientId) || 0) + 1))
        const pid = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        const inv = (await db.invoices.toArray()).find(i => i.status === 'partial') || (await db.invoices.toArray())[0]
        return { pid, inv: inv?.id }
      })
      if (ids.pid) extra.push(`/patients/${ids.pid}`, `/patients/${ids.pid}?tab=chart`, `/patients/${ids.pid}?tab=treatments`, `/patients/${ids.pid}?tab=billing`)
      if (ids.inv) extra.push(`/invoices/${ids.inv}`)
    }
    for (const r of [...ROUTES, ...extra]) {
      await page.goto(`${BASE}/index.html#${r}`)
      await page.waitForTimeout(r.startsWith('/reports') || r === '/' ? 1400 : 900)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (overflow > 1) { problems++; console.log(`OVERFLOW ${name} ${r}: +${overflow}px`) }
      const raw = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /^[a-z]+(\.[a-zA-Z0-9_]+)+$/.test((e.textContent || '').trim())).map(e => e.textContent.trim()).slice(0, 5))
      if (raw.length) { problems++; console.log(`RAW KEYS ${name} ${r}:`, raw) }
      const label = r.replace(/^\//, '').replace(/[/?=]/g, '_').replace(/_[a-z0-9]{20,}/, '_id') || 'home'
      await shot(page, `${name}--${label}`)
    }
    if (errors.length) { problems++; console.log(`ERRORS ${name}:`, [...new Set(errors)].slice(0, 8)) }
    await browser.close()
  }
} finally { server.kill() }
console.log(problems ? `tour finished with ${problems} problem(s)` : 'tour clean')
process.exit(problems ? 1 : 0)
