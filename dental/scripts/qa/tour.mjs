// Screenshots every route of the app in three viewports, after seeding a signed-in clinic.
// Usage: QA_DIST=dist QA_PORT=4173 node scripts/qa/tour.mjs [--demo]   (--demo first loads the demo data through the Settings page)
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const ROUTES = ['/', '/appointments', '/patients', '/treatments', '/prescriptions', '/lab', '/invoices', '/payments', '/expenses', '/reports', '/inventory', '/procedures', '/staff', '/settings', '/settings/license']
const server = await startServer()
let failures = 0
try {
  for (const [name, opts] of [['desktop-ar', { lang: 'ar' }], ['desktop-en', { lang: 'en' }], ['mobile-ar', { lang: 'ar', mobile: true, width: 390, height: 844 }]]) {
    const { browser, page } = await openBrowser(opts)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await seedAndLogin(page, { lang: opts.lang })
    for (const r of ROUTES) {
      await page.goto(`${BASE}/index.html#${r}`)
      await page.waitForTimeout(700)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (overflow > 1) { failures++; console.log(`OVERFLOW ${name} ${r}: +${overflow}px`) }
      await shot(page, `${name}${r.replace(/\//g, '_') || '_home'}`)
    }
    if (errors.length) { failures++; console.log(`PAGE ERRORS ${name}:`, errors.slice(0, 5)) }
    await browser.close()
  }
} finally { server.kill() }
console.log(failures ? `tour finished with ${failures} problem(s)` : 'tour clean')
process.exit(failures ? 1 : 0)
