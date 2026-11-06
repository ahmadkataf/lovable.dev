// Renders public/icon.svg into the PNG icons the website, Windows and Android need. Run once after changing the icon:
//   node scripts-icons.mjs   (needs: npm i --no-save playwright)
import { chromium } from 'playwright'
import fs from 'fs'
const svg = fs.readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
async function render(size, out, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size })
  // maskable icons need the artwork inside the safe zone: draw it smaller on a full-bleed background
  const inner = maskable ? Math.round(size * 0.8) : size
  const html = `<html><body style="margin:0;background:${maskable ? '#0f172a' : 'transparent'};display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`
  await page.setContent(html)
  await page.screenshot({ path: out, omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } })
  console.log(out)
}
await render(192, 'public/icon-192.png')
await render(512, 'public/icon-512.png')
await render(512, 'public/icon-512-maskable.png', { maskable: true })
await render(512, 'electron/icon.png')
for (const [d, s] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  fs.mkdirSync(`android/res/mipmap-${d}`, { recursive: true })
  await render(s, `android/res/mipmap-${d}/ic_launcher.png`)
}
await browser.close()
