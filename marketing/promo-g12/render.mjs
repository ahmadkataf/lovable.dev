import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
const [,, page, outDir, fps, spec] = process.argv
const frames = spec.includes(',') ? spec.split(',').map(Number) : (() => { const [a, b] = spec.split('-').map(Number); return Array.from({ length: b - a }, (_, i) => a + i) })()
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
await p.goto(pathToFileURL(page).href)
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())) })
await p.waitForTimeout(300)
for (const f of frames) {
  await p.evaluate(t => render(t), f / +fps)
  await p.screenshot({ path: `${outDir}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 })
}
await b.close()
