import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
const [,, page, out] = process.argv
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
await p.goto(pathToFileURL(page).href)
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(300)
await p.screenshot({ path: out, type: 'png' })
await b.close()
