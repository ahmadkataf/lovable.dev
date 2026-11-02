import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
const [,, reel, out, spec] = process.argv
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
await p.goto(pathToFileURL(process.cwd() + '/reels.html').href + '#' + reel)
await p.evaluate(async () => { await document.fonts.ready })
await p.waitForTimeout(300)
const frames = spec.includes(',') ? spec.split(',').map(Number) : (() => { const [a, z] = spec.split('-').map(Number); return Array.from({ length: z - a }, (_, i) => a + i) })()
for (const f of frames) { await p.evaluate(t => render(t), f / 30); await p.screenshot({ path: `${out}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 }) }
await b.close()
