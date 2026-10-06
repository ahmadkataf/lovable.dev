import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'url'
const url = pathToFileURL(process.cwd() + '/posts.html').href
const b = await chromium.launch()
const probe = await b.newPage(); await probe.goto(url + '#avatar'); const pages = await probe.evaluate(() => window.PAGES); await probe.close()
for (const id of pages) {
  const p = await b.newPage({ viewport: { width: 1640, height: 1350 } })
  await p.goto(url + '#' + id)
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))) })
  const [w, h] = await p.evaluate(() => window.SIZE)
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(150)
  await p.screenshot({ path: `out/${id}.png`, clip: { x: 0, y: 0, width: w, height: h } })
  await p.close(); console.log(id, w, h)
}
await b.close()
