// Checks for the issues found in the site-editor review. Run against a local API (see README).
import { createRequire } from 'node:module'
import zlib from 'node:zlib'
const { chromium } = createRequire(import.meta.url)('playwright')
const B = process.env.BASE || 'http://127.0.0.1:8799'
const j = async (m, p, body, h = {}) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, b: await r.json().catch(() => null) } }
let fails = 0
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  → ' + JSON.stringify(x))); if (!c) fails++ }
const login = await j('POST', '/v1/team/login', { phone: '0985258963', password: 'Admin123!' })
const auth = { Authorization: `Bearer ${login.b.token}` }
const admin = (await j('GET', '/v1/admin/content', null, auth)).b.content

// a real-looking photo: 900×600 noisy RGB PNG (~1.6 MB raw) the browser must shrink + encode
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = (x * 7 + y * 13 + ((x * y) % 97)) & 255 }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const b = await chromium.launch()
try {
  // 1) long brand texts never push the header buttons off a 360 px phone
  const brand = { ...admin.brand, name_latin: 'Focus Point Coworking Space Daraa Syria', subtitle: 'مساحة عمل مشتركة هادئة للدراسة والشغل والاجتماعات بدرعا' }
  ok('save long brand texts', (await j('PUT', '/v1/admin/content/brand', brand, auth)).s === 200)
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 } }); const page = await ctx.newPage()
  await page.goto(B + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(600)
  const layout = await page.evaluate(() => {
    const out = []; for (const el of document.querySelectorAll('header a, header button')) { const r = el.getBoundingClientRect(); if (r.width) out.push({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20), l: Math.round(r.left), r: Math.round(r.right) }) }
    return { out, sw: document.documentElement.scrollWidth }
  })
  ok('header: every link/button inside the screen', layout.out.every((x) => x.l >= 0 && x.r <= 360), layout.out)
  ok('no horizontal scroll at 360 px', layout.sw <= 360, layout.sw)
  // the change shows at once (no stale cache) and in the page title source
  ok('saved brand is live immediately', (await page.locator('.site-header').innerText()).includes('Focus Point Coworking'), await page.locator('.site-header').innerText())
  await j('DELETE', '/v1/admin/content/brand', null, auth)

  // 2) removing a space-group photo hides it (the default photo is only an on-error fallback)
  const spaces = JSON.parse(JSON.stringify(admin.spaces))
  spaces.groups.open.photo = null
  const put = await j('PUT', '/v1/admin/content/spaces', spaces, auth)
  ok('save spaces with the open-space photo removed', put.s === 200, put)
  await page.goto(B + '/spaces', { waitUntil: 'networkidle' }); await page.waitForTimeout(600)
  const openImgs = await page.evaluate(() => [...document.images].map((i) => i.getAttribute('src')))
  ok('/spaces: removed group photo is not shown', !openImgs.includes(admin.spaces.groups.open.photo?.src), openImgs)
  await j('DELETE', '/v1/admin/content/spaces', null, auth)
  await ctx.close()

  // 3) the link-preview image uploads as JPEG (Chrome would otherwise send WebP, which the field refuses)
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx2.addInitScript((t) => localStorage.setItem('fp_team_token', t), login.b.token)
  const p2 = await ctx2.newPage()
  await p2.goto(B + '/team/site/seo', { waitUntil: 'networkidle' }); await p2.waitForTimeout(800)
  // unfold every group (each click re-renders the list, so always take the first folded one)
  for (let i = 0; i < 12 && await p2.locator('.se-group-head[aria-expanded="false"]').count(); i++) await p2.locator('.se-group-head[aria-expanded="false"]').first().click()
  const input = p2.locator('[data-path="og_image"] input[type=file]')
  await input.setInputFiles({ name: 'share.png', mimeType: 'image/png', buffer: png(900, 600) })
  await p2.waitForTimeout(4000)
  const thumb = await p2.locator('[data-path="og_image"] img').first().getAttribute('src').catch(() => null)
  ok('og image uploaded as .jpg', /\/media\/[0-9a-f]+\.jpg$/.test(thumb || ''), thumb)
  await p2.getByRole('button', { name: /^حفظ/ }).last().click(); await p2.waitForTimeout(2000)
  const seo = (await j('GET', '/v1/content')).b.content.seo
  ok('og image saved', /\.jpg$/.test(seo.og_image.src), seo.og_image)
  const head = await fetch(B + '/').then((r) => r.text())
  ok('page meta og:image uses it', head.includes(seo.og_image.src), head.match(/og:image" content="[^"]+/)?.[0])
  // 4) an uploaded image (stored as base64 now) comes back byte-exact with the right type
  const img = await fetch(B + seo.og_image.src)
  const bytes = Buffer.from(await img.arrayBuffer())
  ok('uploaded image served: 200 image/jpeg, JPEG bytes', img.status === 200 && img.headers.get('content-type') === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8, [img.status, img.headers.get('content-type'), bytes.length])
  await j('DELETE', '/v1/admin/content/seo', null, auth)
  await ctx2.close()
} finally { await b.close() }
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0)
