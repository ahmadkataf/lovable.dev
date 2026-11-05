// Renders brief.html frame by frame with Playwright (time-driven render(t) in the page).
//   node render.mjs <frames dir> <fps> <first-last> [workers]
// Each worker opens its own page and renders an interleaved share of the frames, so the
// screenshots run in parallel; a frame already on disk is skipped (safe to resume).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
const [,, outDir, fpsArg, spec, workersArg] = process.argv
const fps = +fpsArg, [a, b] = spec.split('-').map(Number), workers = +(workersArg || 3)
const page = path.join(path.dirname(new URL(import.meta.url).pathname), 'brief.html')
mkdirSync(outDir, { recursive: true })
const b0 = await chromium.launch()
const t0 = Date.now()
await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const p = await b0.newPage({ viewport: { width: 1920, height: 1080 } })
  await p.goto(pathToFileURL(page).href)
  await p.evaluate(async () => { await document.fonts.ready })
  await p.waitForTimeout(300)
  for (let f = a + w; f <= b; f += workers) {
    const file = `${outDir}/f${String(f).padStart(5, '0')}.jpg`
    if (existsSync(file)) continue
    await p.evaluate(t => render(t), f / fps)
    await p.screenshot({ path: file, type: 'jpeg', quality: 92 })
    if (w === 0 && f % (fps * 10) === 0) console.log(`t=${(f / fps).toFixed(0)}s  ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed`)
  }
  await p.close()
}))
await b0.close()
console.log('done', ((Date.now() - t0) / 1000).toFixed(0), 's')
