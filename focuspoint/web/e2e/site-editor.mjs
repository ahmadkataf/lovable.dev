// Browser check of the admin site editor (team › الموقع) against a local API + built site:
//   edit a text in the home hero → «حفظ» → GET /v1/content shows it → «تراجع عن آخر حفظ» restores it →
//   upload a generated PNG to the hero photo → «حفظ» → the site serves /media/… → «استعادة الأصل» restores the default;
//   plus: validation stops an empty required field before any request, the unsaved-changes guard asks before leaving,
//   and no screen of the editor / settings / rooms scrolls sideways at 360×740.
// Leaves the home section at its default (it starts and ends with DELETE /v1/admin/content/home).
// BASE=<url> to point it elsewhere; OUT=<dir> keeps screenshots.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
const { chromium } = createRequire(import.meta.url)('playwright')

const B = process.env.BASE || 'http://127.0.0.1:8799'
const OUT = process.env.OUT || ''
if (OUT) mkdirSync(OUT, { recursive: true })
let fails = 0
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : `  → ${JSON.stringify(extra)}`)); if (!cond) fails++ }
const j = async (method, path, body, headers = {}) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
  return { s: r.status, b: await r.json().catch(() => null) }
}

/** A small RGB PNG (gradient) built here, so the check needs no image files. */
function png(w, h) {
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < w; x++) { const p = row + 1 + x * 3; raw[p] = Math.round((x / w) * 255); raw[p + 1] = Math.round((y / h) * 255); raw[p + 2] = 140 }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const login = await j('POST', '/v1/team/login', { phone: '0985258963', password: 'Admin123!' })
if (login.s !== 200 || !login.b?.token) { console.log('login failed', login); process.exit(1) }
const auth = { Authorization: `Bearer ${login.b.token}` }
await j('DELETE', '/v1/admin/content/home', null, auth)
const site = async () => (await j('GET', '/v1/content')).b?.content
const orig = (await site())?.home?.hero
ok('GET /v1/content serves the home hero', !!orig?.title && !!orig?.photo?.src, orig)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' })
await ctx.addInitScript((t) => localStorage.setItem('fp_team_token', t), login.b.token)
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
const puts = []
page.on('request', (r) => { if (r.method() === 'PUT' && r.url().includes('/v1/admin/content/')) puts.push(r.url()) })
const shot = async (name) => { if (OUT) await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }) }
const waitFor = (method, part, status = [200, 201]) => page.waitForResponse((r) => r.request().method() === method && r.url().includes(part) && status.includes(r.status()), { timeout: 20000 })

// ---- the list ----
await page.goto(B + '/team/site', { waitUntil: 'networkidle' })
await page.locator('[data-section="home"]').waitFor({ timeout: 20000 })
ok('section list shows every section card', (await page.locator('.se-card[data-section]').count()) >= 11)
ok('home card is marked «الأصل» after a reset', (await page.locator('[data-section="home"] .badge').innerText()).includes('الأصل'))
await shot('1-list')

// ---- open home, unfold the hero group ----
await page.locator('[data-section="home"]').click()
await page.waitForURL('**/team/site/home')
await page.locator('.se-group-head', { hasText: 'الواجهة الرئيسية' }).click()
const title = page.locator('[data-path="hero.title"] input')
await title.waitFor()
ok('hero title field shows the site value', (await title.inputValue()) === orig.title, await title.inputValue())

// validation: an empty required title never reaches the server
await title.fill('')
await page.locator('[data-testid="se-save"]').click()
await page.locator('[data-path="hero.title"] .field-error').waitFor({ timeout: 5000 }).catch(() => {})
ok('empty required field → Arabic error on the field, nothing sent', (await page.locator('[data-path="hero.title"] .field-error').count()) === 1 && puts.length === 0, { puts })

// edit + save
const newTitle = `اختبار المحرر ${Date.now().toString().slice(-6)}`
await title.fill(newTitle)

// unsaved-changes guard: leaving asks first; «رجوع» keeps the text
await page.locator('a.se-back').click()
const guard = page.locator('.sheet', { hasText: 'في تعديلات ما انحفظت' })
await guard.waitFor({ timeout: 5000 }).catch(() => {})
ok('unsaved changes: leaving asks first', (await guard.count()) === 1 && page.url().endsWith('/team/site/home'))
await guard.getByRole('button', { name: 'رجوع' }).click()
ok('…and «رجوع» keeps the typed text', (await title.inputValue()) === newTitle)

let res = waitFor('PUT', '/v1/admin/content/home')
await page.locator('[data-testid="se-save"]').click()
ok('«حفظ» sends PUT /v1/admin/content/home', !!(await res.catch(() => null)))
await page.waitForTimeout(400)
ok('GET /v1/content shows the new title', (await site())?.home?.hero?.title === newTitle)
await shot('2-saved')

// undo
res = waitFor('POST', '/v1/admin/content/home/undo')
await page.getByRole('button', { name: 'تراجع عن آخر حفظ' }).first().click()
await page.locator('.sheet').getByRole('button', { name: 'تراجع', exact: true }).click()
ok('«تراجع عن آخر حفظ» calls undo', !!(await res.catch(() => null)))
await page.waitForTimeout(400)
ok('undo restores the previous title on the site', (await site())?.home?.hero?.title === orig.title)
ok('…and in the form', (await title.inputValue()) === orig.title, await title.inputValue())

// image upload → save
const file = page.locator('[data-path="hero.photo"] input[type="file"]')
res = waitFor('POST', '/v1/admin/media')
await file.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png(900, 600) })
const up = await res.catch(() => null)
const media = up ? await up.json().catch(() => null) : null
ok('picked PNG is resized/encoded and uploaded', !!media?.src?.startsWith('/media/'), media)
await page.locator('[data-path="hero.photo"] img[src*="/media/"]').waitFor({ timeout: 10000 }).catch(() => {})
ok('preview shows the uploaded image', (await page.locator('[data-path="hero.photo"] img[src*="/media/"]').count()) === 1)
await page.locator('[data-path="hero.photo"] .se-alt input').fill('صورة اختبار')
res = waitFor('PUT', '/v1/admin/content/home')
await page.locator('[data-testid="se-save"]').click()
await res.catch(() => null)
await page.waitForTimeout(400)
const photo = (await site())?.home?.hero?.photo
ok('site uses the uploaded photo (src, size, alt)', photo?.src === media?.src && photo?.w === 900 && photo?.h === 600 && photo?.alt === 'صورة اختبار', photo)
if (photo?.src) {
  const img = await fetch(B + photo.src)
  ok('the photo is served from /media/', img.status === 200 && /^image\//.test(img.headers.get('content-type') || ''), img.status)
}
await shot('3-photo')

// reset to default
res = waitFor('DELETE', '/v1/admin/content/home')
await page.getByRole('button', { name: 'استعادة الأصل' }).first().click()
await page.locator('.sheet').getByRole('button', { name: 'استعادة الأصل', exact: true }).click()
ok('«استعادة الأصل» calls DELETE', !!(await res.catch(() => null)))
await page.waitForTimeout(400)
const back = (await site())?.home?.hero
ok('reset restores the default hero', back?.title === orig.title && back?.photo?.src === orig.photo.src, back)
ok('…and the badge says «الأصل»', (await page.locator('.se-head .badge').innerText()).includes('الأصل'))
ok('no page errors in the editor', pageErrors.length === 0, pageErrors)
if (media?.id) await j('DELETE', `/v1/admin/media/${media.id}`, null, auth)   // tidy up (409 while history still uses it is fine)

// ---- 360 px: nothing scrolls sideways ----
const small = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'ar' })
await small.addInitScript((t) => localStorage.setItem('fp_team_token', t), login.b.token)
const p2 = await small.newPage()
for (const path of ['/team/site', '/team/site/home', '/team/site/brand', '/team/site/theme', '/team/settings', '/team/settings/payment', '/team/rooms']) {
  await p2.goto(B + path, { waitUntil: 'networkidle' })
  await p2.waitForTimeout(600)
  if (path.startsWith('/team/site/')) {
    // unfold every group and list item so every widget is measured
    for (let i = 0; i < 30; i++) {
      const closed = p2.locator('.se-group-head[aria-expanded="false"], .se-item-toggle[aria-expanded="false"]').first()
      if (!(await closed.count())) break
      await closed.click()
    }
  }
  const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(`360px ${path}: no horizontal scroll`, over <= 1, { over })
  if (OUT) await p2.screenshot({ path: `${OUT}/360${path.replace(/\//g, '_')}.png`, fullPage: true })
}

await j('DELETE', '/v1/admin/content/home', null, auth)
await browser.close()
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
