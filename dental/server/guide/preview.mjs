// A preview of the user guide's pages (render.ts), rendered to files and served the way the Worker serves them,
// then checked and photographed in Chromium:
//   node server/guide/preview.mjs [--port=4850] [--fixtures[=DIR]] [--images=DIR] [--keep] [--no-check]
// It copies server/site next to the rendered pages (so /css, /js, /fonts and /img/guide/ are the real ones),
// renders the home and every topic in both languages to $GUIDE_PREVIEW (default: the scratchpad's guide-preview/)
// as guide/index.html, guide/<slug>/index.html, en/guide/…, serves that folder on --port with the Worker's security
// headers (PUBLIC_CSP on the pages), and drives the pages with Playwright: no console errors or CSP violations, no
// sideways scroll at 360/390/1024/1440, the search, the table of contents, the lightbox, no JavaScript, print;
// screenshots go to $GUIDE_PREVIEW-shots.
//   --fixtures[=DIR]  the fixture topics of DIR/*.ts instead of the guide's (default: the scratchpad's
//                     guide-renderer/fixtures), with the pictures of --images (default DIR/../img)
//   --images=DIR      a folder like site/img/guide (manifest.json, <lang>/<id>-<width>.webp) to use instead
//   --fake-images[=DIR]  give every shot that has no picture a stand-in (the pictures of DIR, by device; default
//                     the fixtures' pictures), to see the pages as they will look once everything is shot
//   --keep            leave the server up afterwards (Ctrl+C ends it)    --no-check   only render and serve
// It also prints guideProblems(): what is wrong in the topics' data (links to nothing, missing pictures…).
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '/home/user/lovable.dev/dental/node_modules/playwright/index.mjs'
import * as esbuild from '/home/user/lovable.dev/dental/node_modules/esbuild/lib/main.js'
import { CSP, PUBLIC_CSP, SECURITY_HEADERS } from '../src/http.ts'
import { DEFAULT_SETTINGS } from '../src/types.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.resolve(HERE, '..')
const SCRATCH = '/tmp/claude-0/-home-user-lovable-dev/7205b07d-e68a-5001-a5b8-d48a352ced95/scratchpad'
const argv = process.argv.slice(2)
const arg = (name, def) => { const a = argv.find(x => x === `--${name}` || x.startsWith(`--${name}=`)); return a === undefined ? def : a.includes('=') ? a.split('=').slice(1).join('=') : true }
const flag = name => argv.includes(`--${name}`)
const PORT = Number(arg('port', 4850))
const FIXTURES = arg('fixtures', false) === true ? path.join(SCRATCH, 'guide-renderer/fixtures') : arg('fixtures', false) || null
const IMAGES = arg('images', null) || (FIXTURES ? path.resolve(FIXTURES, '../img') : null)
const OUT = path.resolve(process.env.GUIDE_PREVIEW || path.join(SCRATCH, 'guide-preview'))
const SHOTS = `${OUT}-shots`
const ORIGIN = `http://127.0.0.1:${PORT}`
const LANGS = ['ar', 'en']

// ---- the renderer and the topics, bundled (their imports have no extensions, which Node alone cannot resolve) ------
const BUNDLE = path.join(SCRATCH, 'guide-renderer', 'preview.bundle.mjs')
fs.mkdirSync(path.dirname(BUNDLE), { recursive: true })
const fixtureFiles = FIXTURES ? fs.readdirSync(FIXTURES).filter(f => f.endsWith('.ts')).sort().map(f => path.join(FIXTURES, f)) : []
const entry = FIXTURES
  ? `export * from './render.ts';\n${fixtureFiles.map((f, i) => `import t${i} from ${JSON.stringify(f)}`).join('\n')}\nexport const TOPICS = [${fixtureFiles.map((_, i) => `t${i}`).join(', ')}].sort((a, b) => a.order - b.order)`
  : "export * from './render.ts'; export { TOPICS } from './index.ts'"
await esbuild.build({ stdin: { contents: entry, resolveDir: HERE, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'node22', outfile: BUNDLE, logLevel: 'warning' })
const R = await import(`${pathToFileURL(BUNDLE).href}?v=${Date.now()}`)
const TOPICS = R.TOPICS
const assets = { siteCss: true, favicon: true, manifest: true }

// ---- files: site/ copied, the pictures, then the pages ---------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
fs.cpSync(path.join(SERVER, 'site'), OUT, { recursive: true, filter: src => !path.basename(src).startsWith('.') })
if (IMAGES) {
  fs.rmSync(path.join(OUT, 'img/guide'), { recursive: true, force: true })
  fs.cpSync(IMAGES, path.join(OUT, 'img/guide'), { recursive: true })
}
const manifestFile = path.join(OUT, 'img/guide/manifest.json')
const images = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {}
const FAKE = arg('fake-images', false) === true ? path.join(SCRATCH, 'guide-renderer/img') : arg('fake-images', false) || null
if (FAKE) {
  // stand-ins by device, taken in turn from DIR's manifest
  const pool = JSON.parse(fs.readFileSync(path.join(FAKE, 'manifest.json'), 'utf8'))
  const byDevice = { desktop: [], phone: [] }
  for (const [key, img] of Object.entries(pool)) if (key.startsWith('ar/')) byDevice[img.widths[0] <= 780 ? 'phone' : 'desktop'].push([key.slice(3), img])
  let n = 0
  for (const t of TOPICS) for (const shot of t.shots || []) for (const lang of LANGS) {
    if (images[`${lang}/${shot.id}`]) continue
    const list = byDevice[shot.device === 'phone' ? 'phone' : 'desktop']
    if (!list.length) continue
    const [id, img] = list[n++ % list.length]
    fs.mkdirSync(path.join(OUT, 'img/guide', lang), { recursive: true })
    for (const w of img.widths) fs.copyFileSync(path.join(FAKE, lang, `${id}-${w}.webp`), path.join(OUT, 'img/guide', lang, `${shot.id}-${w}.webp`))
    images[`${lang}/${shot.id}`] = img
  }
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true })
  fs.writeFileSync(manifestFile, JSON.stringify(images, null, 1) + '\n')
  console.log(`stand-in pictures for ${n} shot(s) from ${FAKE}`)
}
console.log(`${TOPICS.length} topic(s) (${FIXTURES ? `fixtures from ${FIXTURES}` : 'the guide'}), ${Object.keys(images).length} picture(s) in the manifest`)

const home = lang => R.renderGuideHome(lang, DEFAULT_SETTINGS, ORIGIN, assets, TOPICS)
const topicPage = (lang, topic) => R.renderGuideTopic(lang, DEFAULT_SETTINGS, ORIGIN, assets, topic, TOPICS, images)
const pageFile = (lang, slug) => path.join(OUT, lang === 'en' ? 'en' : '', 'guide', slug || '', 'index.html')
for (const lang of LANGS) {
  fs.mkdirSync(path.dirname(pageFile(lang)), { recursive: true })
  fs.writeFileSync(pageFile(lang), home(lang))
  for (const t of TOPICS) {
    fs.mkdirSync(path.dirname(pageFile(lang, t.slug)), { recursive: true })
    fs.writeFileSync(pageFile(lang, t.slug), topicPage(lang, t))
  }
}
console.log(`pages in ${OUT}/guide and ${OUT}/en/guide`)

const problems = R.guideProblems(TOPICS, images)
if (problems.length) {
  console.log(`\n${problems.length} problem(s) in the topics' data:`)
  for (const p of problems) console.log(`  - ${p}`)
  console.log('')
} else console.log("no problems in the topics' data")

// ---- the server: the pages with the Worker's headers, everything else a static file -----------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, ORIGIN)
  const m = /^(\/en)?\/guide(?:\/([a-z0-9-]+))?\/?$/.exec(url.pathname)
  if (m) {
    const lang = m[1] ? 'en' : 'ar'
    const file = pageFile(lang, m[2])
    if (fs.existsSync(file)) {
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Security-Policy': PUBLIC_CSP, 'Content-Type': TYPES['.html'], 'Content-Language': lang, 'Cache-Control': 'no-store' })
      return res.end(fs.readFileSync(file))
    }
  }
  const file = path.join(OUT, path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''))
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found')
  }
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Security-Policy': CSP, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
  fs.createReadStream(file).pipe(res)
})
await new Promise((resolve, reject) => { server.on('error', reject); server.listen(PORT, '127.0.0.1', resolve) })
console.log(`serving ${ORIGIN}/guide and ${ORIGIN}/en/guide`)

// ---- the checks ------------------------------------------------------------------------------------------------
let failures = 0
const fail = (what) => { failures++; console.error('FAIL', what) }
const ok = (what) => console.log('ok  ', what)
const check = (cond, what) => (cond ? ok(what) : fail(what))

async function run() {
  fs.rmSync(SHOTS, { recursive: true, force: true })
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch()
  /** A page that counts console errors, page errors, failed requests and CSP violations. */
  async function open({ width = 1440, height = 900, mobile = false, lang = 'ar', js = true } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: lang === 'ar' ? 'ar-SY' : 'en-US', javaScriptEnabled: js })
    await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'} in ${e.sourceFile || location.href}`)))
    const pg = await ctx.newPage()
    const errors = []
    pg.on('pageerror', e => errors.push(`page error: ${e.message}`))
    pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    pg.on('response', r => { if (r.status() >= 400 && new URL(r.url()).pathname.startsWith('/img/guide/')) errors.push(`${r.status()} ${r.url()}`) })
    return { ctx, page: pg, errors }
  }
  const settle = async pg => {
    await pg.waitForLoadState('networkidle').catch(() => {})
    await pg.evaluate(() => document.fonts.ready)
    await pg.waitForTimeout(150)
  }
  /** Loads every lazy picture (scrolls through the page), then back to the top. */
  const loadAll = async pg => {
    await pg.evaluate(async () => {
      for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
      await Promise.all([...document.images].map(i => i.decode().catch(() => {})))
    })
    await settle(pg)
  }
  const noSideways = pg => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)
  const url = (lang, slug) => `${ORIGIN}${lang === 'en' ? '/en' : ''}/guide${slug ? `/${slug}` : ''}`
  // the topic photographed: the first with a picture of each device, else the first
  const withPics = TOPICS.filter(t => (t.shots || []).some(s => images[`ar/${s.id}`]))
  const showcase = (withPics.find(t => t.shots.some(s => s.device === 'phone' && images[`ar/${s.id}`])) || withPics[0] || TOPICS[0]).slug

  // every page: status and CSP header, errors, direction, sideways scroll
  for (const lang of LANGS) {
    for (const slug of ['', ...TOPICS.map(t => t.slug)]) {
      for (const [width, height] of [[360, 780], [390, 844], [1024, 768], [1440, 900]]) {
        const mobile = width < 600
        const { ctx, page: pg, errors } = await open({ width, height, mobile, lang })
        const res = await pg.goto(url(lang, slug))
        await settle(pg)
        if (slug === showcase || !slug) await loadAll(pg)
        const name = `${lang} ${slug || 'home'} ${width}`
        check(res.status() === 200 && res.headers()['content-security-policy'] === PUBLIC_CSP, `${name}: 200 with PUBLIC_CSP`)
        check(errors.length === 0, `${name}: no console errors, CSP violations or missing pictures${errors.length ? `: ${errors.join(' | ')}` : ''}`)
        check(await noSideways(pg), `${name}: no horizontal scroll${await noSideways(pg) ? '' : ` (${await pg.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1).slice(0, 5).map(e => `${e.tagName}.${e.className}`).join(', '))})`}`)
        check(await pg.evaluate(l => document.documentElement.lang === l && document.documentElement.dir === (l === 'ar' ? 'rtl' : 'ltr'), lang), `${name}: lang and dir`)
        if ((!slug || slug === showcase) && (width === 390 || width === 1440)) {
          const kind = slug ? 'topic' : 'home'
          await pg.screenshot({ path: path.join(SHOTS, `${kind}-${lang}-${width}.png`) })
          await pg.screenshot({ path: path.join(SHOTS, `${kind}-${lang}-${width}-full.png`), fullPage: true })
        }
        await ctx.close()
      }
    }
  }

  // the home: the search (Arabic-aware), ?q=, Escape
  for (const lang of LANGS) {
    const { ctx, page: pg, errors } = await open({ lang })
    await pg.goto(url(lang))
    await settle(pg)
    const total = await pg.locator('.gd-card').count()
    check(await pg.locator('.gd-search').isVisible(), `${lang} home: the search box is shown with JS`)
    await pg.keyboard.press('/')
    check(await pg.evaluate(() => document.activeElement?.id === 'gd-q'), `${lang} home: "/" focuses the search`)
    const visible = () => pg.locator('.gd-card:visible').count()
    // a title word typed with other letter forms: hamza, taa marbuta, alef maqsura (Arabic) / upper case (English)
    const word = s => s.split(/\s+/).find(w => w.length >= 4) || s
    const topicWord = word(TOPICS[Math.min(3, TOPICS.length - 1)].title[lang].replace(/[«»"]/g, ''))
    const typed = lang === 'ar' ? topicWord.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ي$/, 'ى') : topicWord.toUpperCase()
    await pg.locator('#gd-q').fill(typed)
    await pg.waitForTimeout(100)
    const n = await visible()
    check(n >= 1 && n < total, `${lang} home: "${typed}" (for "${topicWord}") leaves ${n} of ${total} cards`)
    check(new URL(pg.url()).searchParams.get('q') === typed, `${lang} home: the address carries ?q=`)
    check((await pg.locator('#gd-status').textContent()).trim().length > 0, `${lang} home: the status says how many (${(await pg.locator('#gd-status').textContent()).trim()})`)
    await pg.screenshot({ path: path.join(SHOTS, `search-${lang}.png`) })
    await pg.locator('#gd-q').fill('zzqqxx')
    check(await visible() === 0 && await pg.locator('.gd-empty').isVisible(), `${lang} home: no match shows the empty note`)
    await pg.locator('#gd-q').press('Escape')
    check(await visible() === total && await pg.locator('#gd-q').inputValue() === '', `${lang} home: Escape clears the search`)
    // a section title finds its topic and shows the section as a link
    const sec = (TOPICS.find(t => t.blocks.length > 2)?.blocks[2].title[lang] || '').replace(/[*`]/g, '')
    if (sec) {
      await pg.locator('#gd-q').fill(sec)
      await pg.waitForTimeout(100)
      check(await pg.locator('.gd-card-secs:visible li:visible a').count() >= 1, `${lang} home: a section's title ("${sec}") shows the section under its card`)
      await pg.screenshot({ path: path.join(SHOTS, `search-section-${lang}.png`) })
    }
    // ?q= on arrival
    await pg.goto(`${url(lang)}?q=${encodeURIComponent(typed)}`)
    await settle(pg)
    check(await visible() === n, `${lang} home: ?q= filters on arrival`)
    check(errors.length === 0, `${lang} home: no errors through the search${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await ctx.close()
  }

  // a topic: the table of contents follows the reading, the anchor, the lightbox, the phone's "On this page"
  for (const lang of LANGS) {
    const { ctx, page: pg, errors } = await open({ lang })
    await pg.goto(url(lang, showcase))
    await settle(pg)
    const blocks = await pg.locator('.gd-block').evaluateAll(els => els.map(e => e.id))
    if (blocks.length >= 3) {
      const target = blocks[Math.min(2, blocks.length - 1)]
      await pg.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'start', behavior: 'instant' }), target)
      await pg.waitForTimeout(250)
      const act = await pg.locator('.gd-toc-side a.is-active').getAttribute('href').catch(() => null)
      check(act === `#${target}`, `${lang} topic: scrolled to #${target}, the side menu marks ${act}`)
      await pg.screenshot({ path: path.join(SHOTS, `toc-${lang}-1440.png`) })
    }
    const zoom = pg.locator('.gd-zoom').first()
    if (await zoom.count()) {
      await zoom.scrollIntoViewIfNeeded()
      await zoom.click()
      await pg.waitForTimeout(400)
      check(await pg.locator('dialog.gd-lb[open]').count() === 1, `${lang} topic: a picture opens the lightbox`)
      check(await pg.evaluate(() => document.activeElement?.classList.contains('gd-lb-close')), `${lang} topic: the lightbox takes the focus (its close button)`)
      await pg.waitForFunction(() => document.querySelector('dialog.gd-lb img')?.complete)
      await pg.screenshot({ path: path.join(SHOTS, `lightbox-${lang}.png`) })
      if (await pg.locator('.gd-zoom').count() > 1) {
        await pg.keyboard.press(lang === 'ar' ? 'ArrowLeft' : 'ArrowRight')
        check((await pg.locator('.gd-lb-count').textContent()).startsWith('2 /'), `${lang} topic: the arrow key in the reading direction shows the next picture`)
      }
      await pg.keyboard.press('Escape')
      await pg.waitForTimeout(200)
      check(await pg.locator('dialog.gd-lb[open]').count() === 0, `${lang} topic: Escape closes the lightbox`)
      check(await pg.evaluate(() => document.activeElement?.classList.contains('gd-zoom')), `${lang} topic: the focus is back on the picture`)
    }
    check(errors.length === 0, `${lang} topic: no errors through the checks${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await ctx.close()
    // the phone: "On this page" opens, a link closes it and goes there
    const phone = await open({ lang, width: 390, height: 844, mobile: true })
    await phone.page.goto(url(lang, showcase))
    await settle(phone.page)
    if (await phone.page.locator('.gd-toc-m').count()) {
      await phone.page.locator('.gd-toc-m summary').click()
      await phone.page.waitForTimeout(150)
      await phone.page.screenshot({ path: path.join(SHOTS, `toc-phone-${lang}.png`) })
      const last = phone.page.locator('.gd-toc-m a').last()
      const href = await last.getAttribute('href')
      await last.click()
      await phone.page.waitForTimeout(400)
      check(!(await phone.page.locator('.gd-toc-m').evaluate(d => d.open)) && phone.page.url().endsWith(href), `${lang} phone: "On this page" goes to ${href} and closes`)
    }
    await phone.ctx.close()
  }

  // without JavaScript: everything readable, no search box, the table of contents and pictures are plain links
  {
    const { ctx, page: pg } = await open({ lang: 'ar', js: false })
    await pg.goto(url('ar'))
    check(await pg.locator('.gd-search').isHidden(), 'no JS: the search box stays hidden')
    check(await pg.locator('.gd-card').count() === TOPICS.length, 'no JS: every topic card is there')
    await pg.goto(url('ar', showcase))
    check(await pg.locator('.gd-toc-side a[href^="#"]').count() > 0, 'no JS: the table of contents is plain links')
    const href = await pg.locator('.gd-zoom').first().getAttribute('href').catch(() => null)
    check(!href || /\/img\/guide\/ar\/[a-z0-9-]+-\d+\.webp$/.test(href), `no JS: a picture links to its large file (${href})`)
    check(await pg.locator('.gd-print').isHidden(), 'no JS: the print button stays hidden')
    await ctx.close()
  }

  // print, reduced motion and the keyboard's focus ring
  for (const lang of LANGS) {
    const { ctx, page: pg } = await open({ lang })
    await pg.goto(url(lang, showcase))
    await loadAll(pg)
    await pg.emulateMedia({ media: 'print' })
    check(await pg.locator('.gd-side').isHidden() && await pg.locator('.gd-toc-side').isHidden() && await pg.locator('.site-header, .legal-top').first().isHidden(), `${lang} print: only the topic`)
    await pg.screenshot({ path: path.join(SHOTS, `print-${lang}.png`), fullPage: true })
    await pg.pdf?.({ path: path.join(SHOTS, `print-${lang}.pdf`), format: 'A4', printBackground: false }).catch(() => {})
    await ctx.close()
  }
  {
    const { ctx, page: pg } = await open({ lang: 'ar' })
    await pg.emulateMedia({ reducedMotion: 'reduce' })
    await pg.goto(url('ar'))
    await settle(pg)
    for (let i = 0; i < 6; i++) await pg.keyboard.press('Tab')
    await pg.screenshot({ path: path.join(SHOTS, 'focus-ar-1440.png') })
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  console.log(`screenshots in ${SHOTS}`)
}

if (!flag('no-check')) await run()
if (flag('keep')) console.log('serving; Ctrl+C to stop')
else { server.close(); process.exit(failures ? 1 : 0) }
