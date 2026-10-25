// Renders the PWA icons (PNG) from ../shared/logo.svg with Playwright's bundled Chromium.
// Runs automatically before `vite build` (see vite.config.ts) and via `npm run icons`.
// Skips when the PNGs are already newer than the logo; warns (does not fail) when Playwright is missing,
// so a CI box without browsers still builds with the committed icons.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

const here = path.dirname(fileURLToPath(import.meta.url))
const logo = path.resolve(here, '../../shared/logo.svg')
const outDir = path.resolve(here, '../public/icons')

/** @type {{ name: string; size: number; pad: number; bg: string | null }[]} */
const TARGETS = [
  { name: 'icon-192.png', size: 192, pad: 0, bg: null },
  { name: 'icon-512.png', size: 512, pad: 0, bg: null },
  // Maskable: the logo sits inside the safe zone (80%) on a plum background.
  { name: 'icon-512-maskable.png', size: 512, pad: 0.1, bg: '#402127' },
  // iOS home-screen icon: opaque, slightly padded on white.
  { name: 'apple-touch-icon.png', size: 180, pad: 0.06, bg: '#ffffff' },
]

async function mtime(file) {
  try { return (await fs.stat(file)).mtimeMs } catch { return 0 }
}

export async function generateIcons({ force = false, log = console.log } = {}) {
  const logoTime = await mtime(logo)
  if (!logoTime) throw new Error(`logo not found: ${logo}`)
  await fs.mkdir(outDir, { recursive: true })
  const stale = []
  for (const t of TARGETS) {
    const out = path.join(outDir, t.name)
    if (force || (await mtime(out)) < logoTime) stale.push(t)
  }
  if (stale.length === 0) { log('icons: up to date'); return false }

  let chromium
  try {
    ({ chromium } = createRequire(import.meta.url)('playwright'))
  } catch {
    log('icons: playwright is not installed — keeping the existing PNGs')
    return false
  }
  const svg = await fs.readFile(logo, 'utf8')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    for (const t of stale) {
      const inner = Math.round(t.size * (1 - 2 * t.pad))
      const html = `<!doctype html><html><body style="margin:0;width:${t.size}px;height:${t.size}px;display:grid;place-items:center;background:${t.bg ?? 'transparent'}">
        <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`
      await page.setViewportSize({ width: t.size, height: t.size })
      await page.setContent(html)
      await page.screenshot({ path: path.join(outDir, t.name), omitBackground: t.bg === null, clip: { x: 0, y: 0, width: t.size, height: t.size } })
      log(`icons: wrote ${t.name}`)
    }
  } finally {
    await browser.close()
  }
  return true
}

// CLI: node scripts/icons.mjs [--force]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateIcons({ force: process.argv.includes('--force') }).catch((e) => { console.error(e); process.exit(1) })
}
