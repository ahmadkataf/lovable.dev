// A preview of the course pages (render.ts) with fixture recordings, served the way the Worker serves them, checked
// and photographed in Chromium:
//   node server/videos/preview.mjs [--port=4862] [--no-app] [--keep] [--no-check]
// It copies server/site next to the rendered pages, makes a 5-second clip with a tone (VP9 and Opus in an .mp4:
// what this Chromium can decode), captions and a poster for a few chapters with ffmpeg (the posters are pictures of
// the real app with the demo clinic when a QA build is at QA_DIST, else a brand gradient; --no-app skips the app),
// writes manifest.json, renders every page in both
// languages, serves everything on --port with the Worker's security headers (PUBLIC_CSP on the pages, Range on the
// files), then drives the pages with Playwright: no console errors or CSP violations, the video plays, the time
// links seek, "play all" moves on to the next chapter, nothing scrolls sideways at 360/390/1440, screenshots.
// --keep leaves the server up afterwards (Ctrl+C ends it); --no-check only renders and serves.
// Output: $VIDEO_PREVIEW (default: the scratchpad's video-pages/preview) and its ../shots.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
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
const APP = path.resolve(SERVER, '..')
const arg = (name, def) => (process.argv.find(a => a.startsWith(`--${name}=`)) || `--${name}=${def}`).split('=').slice(1).join('=')
const flag = name => process.argv.includes(`--${name}`)
const PORT = Number(arg('port', 4862))
const SCRATCH = process.env.VIDEO_PREVIEW || '/tmp/claude-0/-home-user-lovable-dev/7205b07d-e68a-5001-a5b8-d48a352ced95/scratchpad/video-pages/preview'
const OUT = path.resolve(SCRATCH)
const SHOTS = path.resolve(OUT, '../shots')
const ORIGIN = `http://127.0.0.1:${PORT}`
const QA_DIST = process.env.QA_DIST || '/tmp/dist-guide'
const USE_APP = !flag('no-app') && fs.existsSync(path.join(QA_DIST, 'index.html'))
// Sunday 11 October 2026, 11:40 in Damascus, as the store screenshots (store/scripts/shoot.mjs)
const NOW = new Date('2026-10-11T11:40:00+03:00')

// ---- the renderer, bundled (its imports have no extensions, which Node alone cannot resolve) ------------------
const BUNDLE = path.join(OUT, '..', 'render.bundle.mjs')
fs.mkdirSync(path.dirname(BUNDLE), { recursive: true })
await esbuild.build({
  stdin: { contents: "export * from './render.ts'; export * from './index.ts'", resolveDir: HERE, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', target: 'node22', outfile: BUNDLE, logLevel: 'warning',
})
const { CHAPTERS, chapterBySlug, renderVideosHome, renderVideoChapter } = await import(pathToFileURL(BUNDLE).href)
const assets = { siteCss: true, favicon: true, manifest: true }

// ---- the fixture: which chapters are "recorded" in which language, and the transcript of one still being recorded
const RECORDED = {
  ar: ['getting-started', 'interface', 'dashboard', 'patients', 'chart', 'appointments', 'billing'],
  en: ['getting-started', 'patients', 'appointments', 'licence'],
}
const SCENES_ONLY = ['reports']
const STARTS = [0, 1.6, 3.4]
/** Three scenes from the chapter's summary: the sentence split at its commas. */
function scenes(chapter, lang) {
  const parts = chapter.summary[lang].split(/[،,.]\s*/).map(s => s.trim()).filter(Boolean).slice(0, 3)
  while (parts.length < 3) parts.push(parts[parts.length - 1] || chapter.title[lang])
  return parts.map((text, i) => ({ id: ['open', 'show', 'done'][i], start: STARTS[i], text: text.replace(/[.،]?$/, '.') }))
}
const vtt = sc => `WEBVTT\n\n${sc.map((s, i) => {
  const at = t => `00:${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`
  return `${at(s.start)} --> ${at(sc[i + 1]?.start ?? 5)}\n${s.text}\n`
}).join('\n')}`

// ---- files: site/ copied, then the fixture recordings ---------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
fs.cpSync(path.join(SERVER, 'site'), OUT, { recursive: true, filter: src => !path.basename(src).startsWith('.') })
for (const lang of ['ar', 'en']) fs.mkdirSync(path.join(OUT, 'videos', lang), { recursive: true })

// a route of the real app per chapter, for the poster
const ROUTES = {
  'getting-started': '/', interface: '/', dashboard: '/', patients: '/patients', chart: '/patients?chart', appointments: '/appointments?view=day',
  treatments: '/treatments', billing: '/invoices', prescriptions: '/prescriptions', lab: '/lab', inventory: '/inventory', expenses: '/expenses',
  reports: '/reports', settings: '/settings', staff: '/settings/staff', backup: '/settings/backup', licence: '/settings/license',
}
const posterFile = (lang, slug) => path.join(OUT, 'videos', lang, `${slug}.jpg`)

/** Posters from the QA build: the demo clinic on the chapter's screen, 1280×720, the trial bar hidden. */
async function appPosters() {
  process.env.QA_DIST = QA_DIST
  process.env.QA_PORT = String(PORT)   // the preview's port is free until the preview server starts
  const lib = await import(pathToFileURL(path.join(APP, 'scripts/qa/lib.mjs')).href)
  const server = await lib.startServer()
  const browser = await chromium.launch()
  try {
    for (const lang of ['ar', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: lang === 'ar' ? 'ar-SY' : 'en-US', timezoneId: 'Asia/Damascus' })
      await ctx.addInitScript(() => {
        const add = () => { const s = document.createElement('style'); s.textContent = '[data-qa="trial-bar"]{display:none!important}'; document.head.appendChild(s) }
        if (document.head) add(); else document.addEventListener('DOMContentLoaded', add)
      })
      const page = await ctx.newPage()
      await page.clock.install({ time: NOW })
      await page.goto(`${lib.BASE}/index.html#/`)
      await lib.requireQaHandle(page, 20000)
      await lib.seedAndLogin(page, { lang })
      if (lang === 'en') {
        await page.evaluate(async () => {
          const db = window.__dentora.db
          const names = { 'u-admin': ['Dr. Ahmad Al-Khatib', 'General dentistry'], 'u-doc2': ['Dr. Laila Haddad', 'Orthodontics'], 'u-rec': ['Sara Youssef', undefined] }
          for (const [id, [name, specialty]] of Object.entries(names)) if (await db.users.get(id)) await db.users.update(id, { name, specialty })
          await db.clinic.update('clinic', { name: 'Smile Dental Clinic', nameEn: '', address: 'Al-Jalaa St, Mezzeh, Damascus' })
        })
        await page.reload()
      }
      await lib.loadDemo(page)
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 30000 }).catch(() => {})
      const firstPatient = await page.evaluate(async () => (await window.__dentora.db.patients.toArray()).find(p => !p.archived)?.id)
      for (const slug of RECORDED[lang]) {
        const route = slug === 'chart' && firstPatient ? `/patients/${firstPatient}?tab=chart` : ROUTES[slug] || '/'
        await page.goto(`${lib.BASE}/index.html#${route}`)
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(700)
        await page.screenshot({ path: posterFile(lang, slug), type: 'jpeg', quality: 86 })
        console.log('poster', lang, slug, route)
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
    server.kill()
    // the port must be free again for the preview server
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${lib.BASE}/index.html`); await new Promise(r => setTimeout(r, 200)) } catch { break }
    }
  }
}
/** A brand gradient as the poster, when the app is not available. */
function gradientPoster(lang, slug, i) {
  const hues = ['0x14B8A6:c1=0x0B4F4B', '0x0E8F86:c1=0x072F2D', '0x3EBFAC:c1=0x0A6660']
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `gradients=s=1280x720:c0=${hues[i % hues.length]}:x0=0:y0=0:x1=1280:y1=720:d=1`, '-frames:v', '1', '-q:v', '3', posterFile(lang, slug)], { stdio: 'inherit' })
}

if (USE_APP) {
  console.log(`posters from the app at ${QA_DIST}`)
  await appPosters()
} else {
  console.log(USE_APP === false && !flag('no-app') ? `no QA build at ${QA_DIST}: gradient posters` : 'gradient posters')
  for (const lang of ['ar', 'en']) RECORDED[lang].forEach((slug, i) => gradientPoster(lang, slug, i))
}

const manifest = {}
const probe = file => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim())
for (const lang of ['ar', 'en']) {
  for (const slug of RECORDED[lang]) {
    const chapter = chapterBySlug(slug)
    const dir = path.join(OUT, 'videos', lang), mp4 = path.join(dir, `${slug}.mp4`)
    // 5 seconds of the poster with a soft tone: enough for the player, the captions and "play all" to be real.
    // VP9 and Opus in the .mp4 (not the recorder's H.264/AAC): Playwright's Chromium ships without those two
    // decoders, and a file it cannot decode never reaches loadedmetadata, so play() would wait for ever.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-framerate', '30', '-i', posterFile(lang, slug), '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
      '-t', '5', '-vf', 'fade=t=in:st=0:d=0.4,fade=t=out:st=4.5:d=0.5', '-af', 'volume=0.15', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p',
      '-c:a', 'libopus', '-b:a', '48k', '-strict', '-2', '-movflags', '+faststart', '-shortest', mp4], { stdio: 'inherit' })
    const sc = scenes(chapter, lang)
    fs.writeFileSync(path.join(dir, `${slug}.vtt`), vtt(sc))
    const bytes = fs.readFileSync(mp4)
    manifest[`${lang}/${slug}`] = {
      durationSeconds: probe(mp4), sizeBytes: bytes.length, width: 1280, height: 720,
      sha256: createHash('sha256').update(bytes).digest('hex'), scenes: sc, recordedAt: '2026-10-15T09:00:00Z',
    }
  }
  for (const slug of SCENES_ONLY) manifest[`${lang}/${slug}`] = { durationSeconds: 0, sizeBytes: 0, width: 0, height: 0, sha256: '', scenes: scenes(chapterBySlug(slug), lang) }
}
fs.writeFileSync(path.join(OUT, 'videos', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

// ---- the pages, rendered once to files (to read) and again per request (?t=) -----------------------------------
const home = lang => renderVideosHome(lang, DEFAULT_SETTINGS, ORIGIN, assets, CHAPTERS, manifest)
const chapterPage = (lang, chapter, t) => renderVideoChapter(lang, DEFAULT_SETTINGS, ORIGIN, assets, chapter, CHAPTERS, manifest, { t })
for (const lang of ['ar', 'en']) {
  const dir = path.join(OUT, 'pages', lang)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), home(lang))
  for (const c of CHAPTERS) fs.writeFileSync(path.join(dir, `${c.slug}.html`), chapterPage(lang, c))
}
console.log(`pages in ${path.join(OUT, 'pages')}`)

// ---- the server: pages from the renderer, everything else a static file with Range -----------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
}
function page(res, body, lang) {
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Security-Policy': PUBLIC_CSP, 'Content-Type': TYPES['.html'], 'Content-Language': lang, 'Cache-Control': 'no-store' })
  res.end(body)
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, ORIGIN)
  const p = url.pathname
  const m = /^(\/en)?\/videos(?:\/([a-z-]+))?$/.exec(p)
  if (m) {
    const lang = m[1] ? 'en' : 'ar'
    if (!m[2]) return page(res, home(lang), lang)
    const c = chapterBySlug(m[2])
    if (c) return page(res, chapterPage(lang, c, Number(url.searchParams.get('t')) || 0), lang)
  }
  const file = path.join(OUT, path.normalize(decodeURIComponent(p)).replace(/^(\.\.[/\\])+/, ''))
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain' }); return res.end('not found')
  }
  const size = fs.statSync(file).size, type = TYPES[path.extname(file)] || 'application/octet-stream'
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  const head = { ...SECURITY_HEADERS, 'Content-Security-Policy': CSP, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }
  if (range && size) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2])), end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start > end || start >= size) { res.writeHead(416, { ...head, 'Content-Range': `bytes */${size}` }); return res.end() }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 })
    return fs.createReadStream(file, { start, end }).pipe(res)
  }
  res.writeHead(200, { ...head, 'Content-Length': size })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
})
await new Promise((resolve, reject) => { server.on('error', reject); server.listen(PORT, '127.0.0.1', resolve) })
console.log(`serving ${ORIGIN}/videos and ${ORIGIN}/en/videos`)

// ---- the checks ------------------------------------------------------------------------------------------------
let failures = 0
const fail = (what) => { failures++; console.error('FAIL', what) }
const ok = (what) => console.log('ok  ', what)
const check = (cond, what) => (cond ? ok(what) : fail(what))

async function run() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  /** A page that counts console errors, page errors and CSP violations. */
  async function open({ width = 1440, height = 900, mobile = false, lang = 'ar', js = true } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, locale: lang === 'ar' ? 'ar-SY' : 'en-US', javaScriptEnabled: js })
    await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'} in ${e.sourceFile || location.href}`)))
    const pg = await ctx.newPage()
    const errors = []
    pg.on('pageerror', e => errors.push(`page error: ${e.message}`))
    pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    return { ctx, page: pg, errors }
  }
  // loaded, fonts in, and the player past its metadata (Chromium draws a spinner in the player until then)
  const settle = async pg => {
    await pg.waitForLoadState('networkidle').catch(() => {})
    await pg.evaluate(() => document.fonts.ready)
    await pg.evaluate(() => new Promise(done => {
      const v = document.querySelector('#player video')
      if (!v || v.readyState >= 1) return done()
      v.addEventListener('loadedmetadata', done, { once: true })
      setTimeout(done, 3000)
    }))
    await pg.waitForTimeout(250)
  }
  const noSideways = pg => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)
  const url = (lang, slug) => `${ORIGIN}${lang === 'en' ? '/en' : ''}/videos${slug ? `/${slug}` : ''}`

  // every page: errors, direction, sideways scroll at three widths, screenshots of the home and a chapter
  const PAGES = [['', 'home'], ['patients', 'chapter'], ['reports', 'soon-transcript'], ['treatments', 'soon']]
  for (const lang of ['ar', 'en']) {
    for (const [slug, kind] of PAGES) {
      for (const width of [360, 390, 1440]) {
        const { ctx, page: pg, errors } = await open({ width, height: width < 600 ? 800 : 900, mobile: width < 600, lang })
        const res = await pg.goto(url(lang, slug))
        await settle(pg)
        check(res.status() === 200 && res.headers()['content-security-policy'] === PUBLIC_CSP, `${lang} ${kind} ${width}: 200 with PUBLIC_CSP`)
        check(errors.length === 0, `${lang} ${kind} ${width}: no console errors or CSP violations${errors.length ? `: ${errors.join(' | ')}` : ''}`)
        check(await noSideways(pg), `${lang} ${kind} ${width}: no horizontal scroll`)
        check(await pg.evaluate(l => document.documentElement.lang === l && document.documentElement.dir === (l === 'ar' ? 'rtl' : 'ltr'), lang), `${lang} ${kind} ${width}: lang and dir`)
        if (width !== 360 && (kind === 'home' || kind === 'chapter' || (kind === 'soon-transcript' && width === 1440))) {
          await pg.screenshot({ path: path.join(SHOTS, `${kind}-${lang}-${width < 600 ? 'phone' : 'desktop'}.png`), fullPage: true })
        }
        await ctx.close()
      }
    }
  }

  // the player: plays, the time links seek, keyboard, captions, "play all" goes on to the next chapter and ticks
  for (const lang of ['ar', 'en']) {
    const { ctx, page: pg, errors } = await open({ lang })
    await pg.goto(url(lang, 'patients'))
    await settle(pg)
    const video = pg.locator('#player video')
    check(await video.count() === 1, `${lang}: one <video>`)
    check(await video.evaluate(v => v.querySelector('track')?.default && v.querySelector('track').srclang === document.documentElement.lang), `${lang}: a default caption track in the page's language`)
    check(await pg.locator('.vc-switch').isVisible(), `${lang}: the play-all switch is shown with JS`)
    check(await pg.locator('.vc-keys').isVisible(), `${lang}: the keyboard shortcuts are shown with JS`)
    await video.evaluate(v => v.play())
    await pg.waitForTimeout(900)
    const playing = await video.evaluate(v => !v.paused && v.currentTime > 0.3 && v.readyState >= 2)
    check(playing, `${lang}: the video plays (currentTime ${await video.evaluate(v => v.currentTime.toFixed(2))})`)
    await video.evaluate(v => v.pause())
    // a time link seeks and plays, and its line becomes the active one
    await pg.locator('.vc-time').nth(2).click()
    await pg.waitForTimeout(600)
    const at = await video.evaluate(v => v.currentTime)
    check(at >= 3.3 && at < 4.9 && await video.evaluate(v => !v.paused), `${lang}: the third time link seeks to 3.4 s and plays (at ${at.toFixed(2)})`)
    check(await pg.locator('.vc-line.is-active').count() === 1 && await pg.locator('.vc-line').nth(2).evaluate(li => li.classList.contains('is-active')), `${lang}: the transcript line of the moment is marked`)
    await video.evaluate(v => v.pause())
    // keyboard on the page (not inside a field): K plays, J goes back, C hides the captions
    await pg.locator('h1').click()
    await pg.keyboard.press('k')
    await pg.waitForTimeout(300)
    check(await video.evaluate(v => !v.paused), `${lang}: K plays`)
    await pg.keyboard.press('k')
    await pg.waitForTimeout(100)
    check(await video.evaluate(v => v.paused), `${lang}: K pauses`)
    await video.evaluate(v => { v.currentTime = 4 })
    await pg.keyboard.press('j')
    await pg.waitForTimeout(200)
    check(await video.evaluate(v => v.currentTime < 0.5), `${lang}: J goes ten seconds back (clamped to 0)`)
    const before = await video.evaluate(v => v.textTracks[0].mode)
    await pg.keyboard.press('c')
    const after = await video.evaluate(v => v.textTracks[0].mode)
    check(before === 'showing' && after === 'hidden', `${lang}: C toggles the captions (${before} → ${after})`)
    await pg.keyboard.press('c')
    // play all: on, then the end of this chapter opens the next one, which plays, and this one is ticked
    await pg.locator('.vc-switch').click()
    check(await pg.evaluate(() => localStorage.getItem('dentora.videos.playAll')) === '1', `${lang}: play all is remembered`)
    await video.evaluate(v => { v.currentTime = 4.5; return v.play() })
    await pg.waitForURL(/\/videos\/chart$/, { timeout: 8000 }).then(() => ok(`${lang}: the end of the chapter opened the next one (${pg.url()})`), () => fail(`${lang}: did not move on to the next chapter (${pg.url()})`))
    await settle(pg)
    if (lang === 'ar') {
      // Arabic has chart recorded: it should be playing by itself
      await pg.waitForTimeout(800)
      check(await pg.locator('#player video').evaluate(v => !v.paused && v.currentTime > 0.2).catch(() => false), `${lang}: the next chapter plays by itself`)
      check(!pg.url().includes('autoplay'), `${lang}: ?autoplay= is dropped from the address`)
    } else {
      // English has chart "coming": the page says so, and the transcript list still works
      check(await pg.locator('.vc-soon-panel').count() === 1, `${lang}: a chapter not recorded shows the coming panel`)
      check(await pg.locator('.vc-soon-other').count() === 1, `${lang}: … with a link to the Arabic recording`)
    }
    check(await pg.locator('.vc-item[data-slug="patients"]').evaluate(li => li.classList.contains('is-watched')), `${lang}: the watched chapter is ticked in the list`)
    check(await pg.locator('.vc-item[data-slug="chart"]').evaluate(li => li.classList.contains('is-current')), `${lang}: the current chapter is marked in the list`)
    await pg.goto(url(lang))
    await settle(pg)
    check(await pg.locator('.vc-card[data-slug="patients"]').evaluate(li => li.classList.contains('is-watched')), `${lang}: the home page ticks the watched chapter`)
    check(errors.length === 0, `${lang}: no console errors through the player checks${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await ctx.close()
  }

  // without JavaScript: native controls, plain links, the time link reloads the page with ?t=, no toggle
  {
    const { ctx, page: pg } = await open({ lang: 'ar', js: false })
    await pg.goto(url('ar', 'patients'))
    check(await pg.locator('#player video[controls]').count() === 1, 'no JS: the native player is there')
    check(await pg.locator('.vc-switch').count() === 1 && !(await pg.locator('.vc-switch').isVisible()), 'no JS: the play-all switch stays hidden')
    check(await pg.locator('.vc-time').nth(1).getAttribute('href') === '?t=1#player', 'no JS: a time link is a plain link to ?t=')
    await pg.locator('.vc-time').nth(1).click()
    await pg.waitForLoadState('load')
    check(pg.url().endsWith('/videos/patients?t=1#player'), `no JS: the time link reloaded the page at ?t= (${pg.url()})`)
    check((await pg.locator('#player source').getAttribute('src')).endsWith('#t=1'), 'no JS: the server started the video at the time asked')
    await ctx.close()
  }

  // print: the transcript shows, the player and the lists do not
  {
    const { ctx, page: pg } = await open({ lang: 'en' })
    await pg.goto(url('en', 'patients'))
    await settle(pg)
    await pg.emulateMedia({ media: 'print' })
    check(await pg.locator('.vc-player').isHidden() && await pg.locator('.vc-aside').isHidden() && await pg.locator('.vc-lines').isVisible(), 'print: the transcript, not the player')
    await pg.screenshot({ path: path.join(SHOTS, 'print-en.png'), fullPage: true })
    await ctx.close()
  }

  // reduced motion and keyboard focus: a focused card shows a ring (no exception, the ring is CSS; just a photo)
  {
    const { ctx, page: pg } = await open({ lang: 'ar', width: 1440 })
    await pg.emulateMedia({ reducedMotion: 'reduce' })
    await pg.goto(url('ar'))
    await settle(pg)
    await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab')
    await pg.screenshot({ path: path.join(SHOTS, 'focus-ar-desktop.png') })
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  console.log(`screenshots in ${SHOTS}`)
}

if (!flag('no-check')) await run()
if (flag('keep')) console.log('serving; Ctrl+C to stop')
else { server.close(); process.exit(failures ? 1 : 0) }
