// node hits.mjs <lang> [page.html] [timelinePrefix]  -> hits4-<lang>.json (sound cues + caption groups + anchor times from the page)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
import { readFileSync, writeFileSync } from 'fs'
const [,, lang, pageFile = 'hook.html', tlPrefix = 'timeline4'] = process.argv
const tl = JSON.parse(readFileSync(`${tlPrefix}-${lang}.json`, 'utf8'))
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +(process.env.VW || 1080), height: +(process.env.VH || 1920) } })
p.on('pageerror', e => console.error('PAGEERROR', e.message)); p.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()) })
await p.goto(pathToFileURL(process.cwd() + '/' + pageFile).href)
await p.evaluate(async () => { await document.fonts.ready })
await p.evaluate(([l, t]) => { setLang(l); setTimeline(t) }, [lang, tl])
const out = await p.evaluate(() => ({ hits: getHits(), groups: getGroups(), T: getT() }))
writeFileSync(`hits4-${lang}.json`, JSON.stringify(out))
console.log(lang, out.hits.length, 'hits,', out.groups.length, 'caption groups'); await b.close()
