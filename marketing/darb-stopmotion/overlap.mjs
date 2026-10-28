// Scans every 0.25 s for overlapping text labels (and labels covering the puppet's or shop owner's face); prints pairs.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
import { readFileSync } from 'fs'
const [,, lang, pageFile = 'stopmotion.html', tlPrefix = 'timeline', sel = '.lbl'] = process.argv
const tl = JSON.parse(readFileSync(`${tlPrefix}-${lang}.json`, 'utf8'))
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto(pathToFileURL(process.cwd() + '/' + pageFile).href)
await p.evaluate(async () => { await document.fonts.ready })
await p.evaluate(([l, t]) => { setLang(l); setTimeline(t) }, [lang, tl])
const seen = new Map()
for (let t = 0; t < tl.total; t += 0.25) {
  const res = await p.evaluate(([t, sel]) => {
    render(t)
    const L = [...document.querySelectorAll(sel)].filter(e => +getComputedStyle(e).opacity > 0.5 && e.textContent.trim()).map(e => { const r = e.getBoundingClientRect(); return { k: e.textContent.slice(0, 24), x: r.left, y: r.top, w: r.width, h: r.height } })
    const out = []
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], c = L[j]; const pad = 6
      const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x) - pad, oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y) - pad
      if (ox > 0 && oy > 0) out.push(`${a.k} <> ${c.k} (${Math.round(ox)}x${Math.round(oy)})`)
    }
    // labels off-screen
    for (const a of L) if (a.x < 0 || a.x + a.w > 1920 || a.y < 0 || a.y + a.h > 1080) out.push(`OFFSCREEN ${a.k} x=${Math.round(a.x)} w=${Math.round(a.w)} y=${Math.round(a.y)}`)
    return out
  }, [t, sel])
  for (const r of res) { if (!seen.has(r)) seen.set(r, []); seen.get(r).push(t.toFixed(2)) }
}
for (const [k, ts] of seen) console.log(`${lang} | ${k} | t=${ts[0]}..${ts[ts.length - 1]} (${ts.length})`)
if (!seen.size) console.log(lang, 'no overlaps')
await b.close()
