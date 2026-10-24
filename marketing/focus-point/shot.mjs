// Screenshot a static page: node shot.mjs <page.html> <out.png> <width> <height>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
const [,, page, out, w, h] = process.argv
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } })
await p.goto(pathToFileURL(page).href)
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))) })
await p.waitForTimeout(200); await p.screenshot({ path: out }); await b.close()
