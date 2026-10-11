// Smoke test of the shell: desktop RTL, desktop LTR, phone (390×844, and its "More" sheet). Fails on a page error, a
// console error (Content-Security-Policy violations included) or a page that scrolls sideways. Needs a QA build
// (one with window.__dentora):
//   VITE_QA=1 npx vite build --outDir /tmp/dist-smoke
//   QA_DIST=/tmp/dist-smoke QA_PORT=4430 QA_SHOTS=qa-shots/smoke node scripts/qa/smoke.mjs
// Without QA_DIST (npm run qa:smoke) it first makes its own QA build in a temporary folder, so dist/ stays the release
// build that npm run build made (release builds never have window.__dentora; package.json must not set VITE_QA).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
if (!process.env.QA_DIST) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-smoke-'))
  console.log(`smoke: no QA_DIST, building a QA build in ${out}`)
  process.env.VITE_QA = '1'
  const { build } = await import('vite')
  await build({ root: ROOT, logLevel: 'warn', build: { outDir: out, emptyOutDir: true } })
  process.env.QA_DIST = out
}
// lib.mjs reads QA_DIST when it is loaded
const { startServer, openBrowser, seedAndLogin, shot } = await import('./lib.mjs')

let problems = 0
const server = await startServer()
try {
  for (const [name, opts] of [['desktop-ar', { lang: 'ar' }], ['desktop-en', { lang: 'en' }], ['mobile-ar', { lang: 'ar', mobile: true, width: 390, height: 844 }]]) {
    const { browser, page } = await openBrowser(opts)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await seedAndLogin(page, { lang: opts.lang })
    await page.waitForTimeout(600)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (overflow > 1) { problems++; console.log(`OVERFLOW ${name}: +${overflow}px`) }
    await shot(page, `smoke-${name}`)
    if (name === 'mobile-ar') { await page.click('text=المزيد'); await page.waitForTimeout(400); await shot(page, 'smoke-mobile-more') }
    if (errors.length) { problems++; console.log(`ERRORS ${name}:`, [...new Set(errors)].slice(0, 8)) }
    await browser.close()
  }
} finally { server.kill() }
console.log(problems ? `smoke finished with ${problems} problem(s)` : 'smoke clean')
process.exit(problems ? 1 : 0)
