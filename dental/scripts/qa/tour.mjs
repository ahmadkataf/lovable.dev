// Screenshots every screen of the app in three viewports (desktop Arabic, desktop English, phone 390×844),
// optionally after loading the demo clinic, and reports horizontal overflow and page errors.
//   npx vite build --outDir /tmp/dist-tour
//   QA_DIST=/tmp/dist-tour QA_PORT=4420 QA_SHOTS=qa-shots/tour node scripts/qa/tour.mjs [--demo] [--only=desktop-ar,mobile-ar]
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEMO = process.argv.includes('--demo')
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean)
const ROUTES = ['/', '/appointments', '/patients', '/treatments', '/prescriptions', '/lab', '/invoices', '/payments', '/expenses', '/reports', '/inventory', '/procedures', '/staff', '/settings', '/settings/preferences', '/settings/backup', '/settings/license']

async function demoBundle() {
  const { build } = await import('vite')
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-tour-seed-'))
  await build({
    configFile: false, root: ROOT, logLevel: 'warn',
    resolve: { alias: { '@': path.join(ROOT, 'src') } },
    define: { __APP_VERSION__: '"qa"', 'process.env.NODE_ENV': '"production"' },
    build: { outDir: out, emptyOutDir: true, minify: false, lib: { entry: path.join(ROOT, 'src/features/seed/demo.ts'), name: 'DentoraSeed', formats: ['iife'], fileName: () => 'seed.js' } },
  })
  return path.join(out, 'seed.js')
}

const bundle = DEMO ? await demoBundle() : null
const server = await startServer()
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
    if (bundle) {
      await page.addScriptTag({ path: bundle })
      const counts = await page.evaluate(async () => { const r = await window.DentoraSeed.loadDemoData(); return r })
      console.log(name, 'demo data:', JSON.stringify(counts).slice(0, 200))
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
