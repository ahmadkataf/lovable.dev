// Renders public/icon.svg to PNG files with Chromium (Playwright). Shared by the Windows and Android builds.
//   node scripts/make-icons.mjs <out-dir> <size> [<size>...]      → <out-dir>/icon-<size>.png
//   node scripts/make-icons.mjs --apple                            → public/apple-touch-icon.png (180px)
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = fs.readFileSync(path.join(ROOT, 'public/icon.svg'), 'utf8')
const args = process.argv.slice(2)
const jobs = args[0] === '--apple' ? [[path.join(ROOT, 'public'), 180, 'apple-touch-icon.png']] : args.slice(1).map(s => [args[0], Number(s), `icon-${s}.png`])
if (!jobs.length) { console.error('usage: make-icons.mjs <out-dir> <size>... | --apple'); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [dir, size, name] of jobs) {
  fs.mkdirSync(dir, { recursive: true })
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  await page.screenshot({ path: path.join(dir, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
  console.log('icon', path.relative(ROOT, path.join(dir, name)))
}
await browser.close()
