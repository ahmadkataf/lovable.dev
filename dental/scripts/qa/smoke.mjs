// Smoke test of the shell: desktop RTL, desktop LTR, phone. Usage: node scripts/qa/smoke.mjs
import { startServer, openBrowser, seedAndLogin, shot } from './lib.mjs'
import fs from 'node:fs'
fs.mkdirSync('qa-shots', { recursive: true })
const server = await startServer()
try {
  for (const [name, opts] of [['desktop-ar', { lang: 'ar' }], ['desktop-en', { lang: 'en' }], ['mobile-ar', { lang: 'ar', mobile: true, width: 390, height: 844 }]]) {
    const { browser, page } = await openBrowser(opts)
    await seedAndLogin(page, { lang: opts.lang })
    await page.waitForTimeout(600)
    await shot(page, `smoke-${name}`)
    if (name === 'mobile-ar') { await page.click('text=المزيد'); await page.waitForTimeout(400); await shot(page, 'smoke-mobile-more') }
    await browser.close()
  }
} finally { server.kill() }
