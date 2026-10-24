// Renders public/icon.svg into every raster icon the shells need, with the Chromium that ships with playwright-core:
//   public/icon-512.png, icon-192.png, apple-touch-icon.png (180)   the PWA / browser icons
//   build/icon.png (512), build/icon-1024.png                        Electron (Linux/mac) and store listings
//   build/icon.ico (16, 24, 32, 48, 64, 128, 256 — PNG entries)      the Windows exe / installer icon
//   build/icon-fg.png, build/icon-bg.png (432)                       the Android adaptive icon layers (scripts/android-res.py)
// Usage: node scripts/make-icons.mjs            (CHROMIUM=/path/to/chrome to use another binary)
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { buildIco, parseIco } from './ico.cjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SVG = path.join(ROOT, 'public', 'icon.svg')
const OUT_PUBLIC = path.join(ROOT, 'public')
const OUT_BUILD = path.join(ROOT, 'build')
const SIZES = [1024, 512, 256, 192, 180, 128, 64, 48, 32, 24, 16]
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const ADAPTIVE = 432 // 108dp at xxxhdpi

const DEFAULT_CHROMIUM = '/opt/pw-browsers/chromium'

async function pickExecutable() {
  const wanted = process.env.CHROMIUM || DEFAULT_CHROMIUM
  try { await fs.access(wanted); return wanted } catch { /* not there */ }
  try { return chromium.executablePath() } catch { return undefined }
}

function dataUrl(svg) {
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64')
}

/** The icon without its rounded background, scaled into the adaptive-icon safe zone (the centre 66% of 108dp). */
function foregroundSvg(svg) {
  return svg
    .replace(/<rect width="512" height="512" rx="112"[^>]*\/>\s*/, '')
    .replace('viewBox="0 0 512 512"', 'viewBox="-80 -80 672 672"')
}

/** Only the gradient background, filling the whole 108dp layer (the launcher masks it into its shape). */
function backgroundSvg(svg) {
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#g)"/></svg>`
}

async function render(page, svg, size) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}img{display:block}</style></head>` +
    `<body><img id="i" src="${dataUrl(svg)}" width="${size}" height="${size}" alt=""></body></html>`,
    { waitUntil: 'load' },
  )
  await page.waitForFunction(() => { const i = document.getElementById('i'); return i && i.complete && i.naturalWidth > 0 })
  return page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}

async function main() {
  const svg = await fs.readFile(SVG, 'utf8')
  await fs.mkdir(OUT_BUILD, { recursive: true })
  const executablePath = await pickExecutable()
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-gpu'], headless: true })
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    const png = {}
    for (const size of SIZES) png[size] = await render(page, svg, size)
    const fg = await render(page, foregroundSvg(svg), ADAPTIVE)
    const bg = await render(page, backgroundSvg(svg), ADAPTIVE)

    const writes = [
      [path.join(OUT_PUBLIC, 'icon-512.png'), png[512]],
      [path.join(OUT_PUBLIC, 'icon-192.png'), png[192]],
      [path.join(OUT_PUBLIC, 'apple-touch-icon.png'), png[180]],
      [path.join(OUT_BUILD, 'icon.png'), png[512]],
      [path.join(OUT_BUILD, 'icon-1024.png'), png[1024]],
      [path.join(OUT_BUILD, 'icon-fg.png'), fg],
      [path.join(OUT_BUILD, 'icon-bg.png'), bg],
      [path.join(OUT_BUILD, 'icon.ico'), buildIco(ICO_SIZES.map(s => png[s]))],
    ]
    for (const [file, data] of writes) {
      await fs.writeFile(file, data)
      console.log(path.relative(ROOT, file).padEnd(28), String(data.length).padStart(8), 'bytes')
    }
    const ico = parseIco(await fs.readFile(path.join(OUT_BUILD, 'icon.ico')))
    console.log('icon.ico entries:', ico.map(i => i.width + 'x' + i.height).join(', '))
  } finally {
    await browser.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
