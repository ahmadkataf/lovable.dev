// node render.mjs <lang> <outDir> <fps> <spec>   spec: "a-b" frame range, or "t:1.5,20.3" explicit times (seconds)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
import { readFileSync, mkdirSync } from 'fs'
const [,, lang, outDir, fpsS, spec, pageFile = 'stopmotion.html', tlPrefix = 'timeline'] = process.argv
const fps = +fpsS
const tl = JSON.parse(readFileSync(`${tlPrefix}-${lang}.json`, 'utf8'))
mkdirSync(outDir, { recursive: true })
let jobs
if (spec.startsWith('t:')) jobs = spec.slice(2).split(',').map((t, i) => ({ t: +t, name: `p${String(i).padStart(2, '0')}_${(+t).toFixed(1)}s`, type: 'png' }))
else { const [a, b] = spec.split('-').map(Number); jobs = Array.from({ length: b - a }, (_, i) => ({ t: (a + i) / fps, name: `f${String(a + i).padStart(5, '0')}`, type: 'jpeg' })) }
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto(pathToFileURL(process.cwd() + '/' + pageFile).href)
await p.evaluate(async () => { await document.fonts.ready })
await p.evaluate(([l, t]) => { setLang(l); setTimeline(t) }, [lang, tl])
await p.waitForTimeout(300)
for (const j of jobs) {
  await p.evaluate(t => render(t), j.t)
  await p.screenshot({ path: `${outDir}/${j.name}.${j.type === 'png' ? 'png' : 'jpg'}`, type: j.type, ...(j.type === 'jpeg' ? { quality: 92 } : {}) })
}
await b.close()
console.log('rendered', jobs.length)
