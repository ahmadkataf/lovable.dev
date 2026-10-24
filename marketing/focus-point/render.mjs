// Render frames of a time-driven page: node render.mjs <page.html> <outDir> <fps> <from-to|f1,f2,...>
// The page must define window.render(t) (seconds). Frames are JPEGs f00000.jpg ... at 1080×1920 (H env to change).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
import fs from 'fs'
const [,, page, outDir, fps, spec] = process.argv
const frames = spec.includes(',') ? spec.split(',').map(Number) : (() => { const [a, b] = spec.split('-').map(Number); return Array.from({ length: b - a }, (_, i) => a + i) })()
fs.mkdirSync(outDir, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1080, height: +(process.env.H || 1920) } })
p.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1 })
await p.goto(pathToFileURL(page).href)
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))) })
await p.waitForTimeout(300)
for (const f of frames) {
  await p.evaluate(t => render(t), f / +fps)
  await p.screenshot({ path: `${outDir}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: +(process.env.Q || 93) })
}
await b.close()
