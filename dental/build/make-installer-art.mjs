// Draws the Windows installer's side picture (the welcome and finish pages of Dentora-Setup.exe and of the uninstaller):
// build/installerSidebar.bmp and build/uninstallerSidebar.bmp, 164×314 px, 24-bit BMP as NSIS needs.
// The logo is public/icon.svg; the words are rendered by Chromium (Playwright) with the app's own fonts, so the Arabic
// line is shaped correctly. Re-run after changing the logo:
//   node build/make-installer-art.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const W = 164, H = 314
const font = f => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'node_modules', f)).toString('base64')
const logo = fs.readFileSync(path.join(ROOT, 'public', 'icon.svg'), 'utf8')
  .replace('<rect width="256" height="256" rx="60" fill="url(#g)"/>', '<rect width="256" height="256" rx="60" fill="#ffffff" fill-opacity=".14"/>')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; src: url(${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
@font-face { font-family: Kufi; src: url(${font('@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-arabic-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden }
body { background: linear-gradient(160deg, #14B8A6 0%, #0E8F86 62%, #0B766F 100%); color: #fff; position: relative; font-family: Inter }
.ring { position: absolute; border-radius: 50%; border: 1px solid rgba(255,255,255,.12) }
.r1 { width: 260px; height: 260px; left: -120px; bottom: -110px }
.r2 { width: 180px; height: 180px; left: -80px; bottom: -70px }
.logo { position: absolute; top: 64px; left: 50%; width: 76px; height: 76px; margin-left: -38px }
.logo svg { width: 76px; height: 76px }
.name { position: absolute; top: 152px; width: 100%; text-align: center; font-size: 25px; font-weight: 700; letter-spacing: -.3px }
.ar { position: absolute; top: 190px; width: 100%; text-align: center; font-family: Kufi; font-size: 11.5px; font-weight: 500; direction: rtl; opacity: .95 }
.en { position: absolute; top: 211px; width: 100%; text-align: center; font-size: 10px; font-weight: 500; opacity: .8 }
</style></head><body>
<div class="ring r1"></div><div class="ring r2"></div>
<div class="logo">${logo}</div>
<div class="name">Dentora</div>
<div class="ar">إدارة عيادات الأسنان</div>
<div class="en">Dental clinic management</div>
</body></html>`

/** A 24-bit bottom-up BMP from RGBA pixels (what NSIS's welcome page loads). */
function bmp24(rgba, w, h) {
  const row = Math.ceil((w * 3) / 4) * 4
  const size = 54 + row * h
  const b = Buffer.alloc(size)
  b.write('BM', 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10)
  b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28)
  b.writeUInt32LE(row * h, 34); b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42)
  for (let y = 0; y < h; y++) {
    const dst = 54 + (h - 1 - y) * row
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      b[dst + x * 3] = rgba[s + 2]; b[dst + x * 3 + 1] = rgba[s + 1]; b[dst + x * 3 + 2] = rgba[s]
    }
  }
  return b
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot({ type: 'png' })
  // decode the PNG in the page (no image library needed here)
  const rgba = await page.evaluate(async b64 => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    return Array.from(g.getImageData(0, 0, img.width, img.height).data)
  }, png.toString('base64'))
  const out = bmp24(Uint8Array.from(rgba), W, H)
  for (const name of ['installerSidebar.bmp', 'uninstallerSidebar.bmp']) fs.writeFileSync(path.join(ROOT, 'build', name), out)
  console.log(`build/installerSidebar.bmp, build/uninstallerSidebar.bmp (${W}×${H}, ${out.length} bytes)`)
} finally {
  await browser.close()
}
