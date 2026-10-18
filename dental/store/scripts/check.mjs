// Checks the store folder against Google Play's rules before upload: picture sizes and aspect ratios, opaque PNGs
// (no alpha) where Play requires them, file sizes, and the listing texts' character limits.
//   node store/scripts/check.mjs        (exit code 1 on any problem)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const STORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const fail = msg => problems.push(msg)

/** Width, height and colour type of a PNG, from its IHDR chunk (2 = RGB, 6 = RGBA). */
function png(file) {
  const b = fs.readFileSync(file)
  if (b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${file}: not a PNG`)
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25], bytes: b.length }
}
const list = dir => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().map(f => path.join(dir, f)) : [])

function expect(file, { width, height, opaque = true, maxBytes = 8 * 1024 * 1024, screenshot = true }) {
  const rel = path.relative(STORE, file)
  if (!fs.existsSync(file)) return fail(`${rel}: missing`)
  const p = png(file)
  if (p.width !== width || p.height !== height) fail(`${rel}: ${p.width}×${p.height}, expected ${width}×${height}`)
  if (opaque && p.colorType !== 2) fail(`${rel}: has an alpha channel (colour type ${p.colorType}); Play wants 24-bit PNG`)
  if (p.bytes > maxBytes) fail(`${rel}: ${(p.bytes / 1048576).toFixed(1)} MB, over ${(maxBytes / 1048576).toFixed(0)} MB`)
  // Play: the long side of a screenshot is at most twice the short one
  if (screenshot && Math.max(p.width, p.height) > 2 * Math.min(p.width, p.height)) fail(`${rel}: aspect ratio over 2:1`)
  return p
}

expect(path.join(STORE, 'icon-512.png'), { width: 512, height: 512, maxBytes: 1024 * 1024, screenshot: false })
expect(path.join(STORE, 'feature-graphic-1024x500.png'), { width: 1024, height: 500, maxBytes: 15 * 1024 * 1024, screenshot: false })
expect(path.join(STORE, 'feature-graphic-1024x500-en.png'), { width: 1024, height: 500, maxBytes: 15 * 1024 * 1024, screenshot: false })

const SETS = [
  ['phone', 1080, 1920], ['tablet7', 1080, 1920], ['tablet10', 2560, 1440],
]
for (const lang of ['ar', 'en']) {
  for (const [device, width, height] of SETS) {
    for (const kind of ['screenshots', 'framed']) {
      const files = list(path.join(STORE, kind, device, lang))
      const min = device === 'phone' ? 4 : 2
      if (files.length < min) fail(`${kind}/${device}/${lang}: ${files.length} pictures, at least ${min} needed`)
      if (files.length > 8) fail(`${kind}/${device}/${lang}: ${files.length} pictures, Play takes at most 8`)
      for (const f of files) expect(f, { width, height })
    }
  }
  for (const f of list(path.join(STORE, 'screenshots', 'desktop', lang))) expect(f, { width: 3200, height: 1800, maxBytes: 50 * 1024 * 1024 })
  expect(path.join(STORE, 'web', `og-${lang}.png`), { width: 1200, height: 630, screenshot: false })
  expect(path.join(STORE, 'web', `hero-${lang}.png`), { width: 2400, height: 1500, opaque: false, screenshot: false })
}

// listing texts: the code blocks of LISTING.md, in order, per language
const listing = fs.readFileSync(path.join(STORE, 'LISTING.md'), 'utf8')
const blocks = [...listing.matchAll(/```\n([\s\S]*?)\n```/g)].map(m => m[1])
const LIMITS = [['ar name', 30], ['ar short description', 80], ['ar full description', 4000], ['ar what\'s new', 500],
  ['en name', 30], ['en short description', 80], ['en full description', 4000], ['en what\'s new', 500]]
LIMITS.forEach(([name, limit], i) => {
  const text = blocks[i]
  if (text === undefined) return fail(`LISTING.md: ${name} missing`)
  const n = [...text].length
  if (n > limit) fail(`LISTING.md: ${name} is ${n} characters, limit ${limit}`)
  // Play's payments policy: no prices or purchase calls in the listing (the clinic's own "price list" is fine)
  if (/\$\s?\d|\d\s?\$|\bUSD\b|\bbuy\b|\bpurchas|\bsubscri|اشتر|شراء/i.test(text)) fail(`LISTING.md: ${name} mentions a price or a purchase`)
  console.log(`${name}: ${n}/${limit}`)
})

if (problems.length) { console.error(problems.map(p => `PROBLEM ${p}`).join('\n')); process.exit(1) }
console.log('store check clean')
