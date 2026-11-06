// Store pictures composed from the brand and the app's screenshots, drawn by Chromium (Playwright) with the app's own
// fonts (Inter + Noto Kufi Arabic, from node_modules), so Arabic is shaped correctly and nothing needs a design tool.
//   node store/scripts/compose.mjs [icon] [feature] [frames] [web]        (no argument: all of them)
// Inputs: public/icon.svg; store/screenshots/** and the taller phone captures in $STORE_WORK (store/scripts/shoot.mjs).
// Outputs (opaque 24-bit PNGs where Google Play asks for them):
//   store/icon-512.png                          512×512, full square: Play applies its own mask and shadow
//   store/feature-graphic-1024x500[-en].png     Play feature graphic (Arabic listing, English listing)
//   store/framed/<device>/<lang>/NN-<screen>.png   screenshots in a branded frame with a caption, same sizes as raw
//   store/web/hero-<lang>.png                   desktop window + phone, transparent background (website)
//   store/web/og-<lang>.png                     1200×630 link preview (website, social)
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const STORE = path.join(ROOT, 'store')
const SHOTS = path.join(STORE, 'screenshots')
const WORK = process.env.STORE_WORK || '/tmp/dentora-store-work'
const TMP = path.join(WORK, 'compose')
const jobs = process.argv.slice(2).filter(a => !a.startsWith('--'))
const want = name => !jobs.length || jobs.includes(name)

// ---- brand -------------------------------------------------------------------------------------------------------
const font = f => pathToFileURL(path.join(ROOT, 'node_modules', f)).href
const FONTS = `
@font-face { font-family: Inter; src: url(${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
@font-face { font-family: Kufi; src: url(${font('@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-arabic-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
`
const ICON = fs.readFileSync(path.join(ROOT, 'public/icon.svg'), 'utf8')
const TOOTH_PATH = ICON.match(/<path d="([^"]+)"/)[1]
const SPARK = ICON.match(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/).slice(1).map(Number)
// the mark's box inside the 256-unit icon (path 60–180 × 47–193, sparkle circle 164–192 × 64–92): centre (125, 120)
const MARK_CX = 125, MARK_CY = 120
/** The white tooth mark, centred on (128,128) of a 256 box and scaled by k. */
const mark = (k = 1, fill = '#fff') => `<g transform="translate(128 128) scale(${k}) translate(${-MARK_CX} ${-MARK_CY})">
  <g opacity=".97" fill="${fill}"><path d="${TOOTH_PATH}"/></g>
  <circle cx="${SPARK[0]}" cy="${SPARK[1]}" r="${SPARK[2]}" fill="${fill}" opacity=".9"/></g>`
/** The app icon (rounded square), as in public/icon.svg, with the mark centred. */
const appIcon = (size, radius = 60) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
  <defs><linearGradient id="ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#0E8F86"/></linearGradient></defs>
  <rect width="256" height="256" rx="${radius}" fill="url(#ig)"/>${mark(1)}</svg>`

const BASE_CSS = `${FONTS}
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { overflow: hidden }
body { font-family: Inter, Kufi, sans-serif; color: #0F172A; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision }
[lang="ar"] { font-family: Inter, Kufi, sans-serif }
.ar { font-family: Kufi, Inter, sans-serif }
img { display: block }
`

// ---- captions ----------------------------------------------------------------------------------------------------
// [headline with *accent*, one supporting line]; short, large, and true to what the screen shows
const CAPTIONS = {
  dashboard: {
    ar: ['عيادتك كلها *في شاشة واحدة*', 'مواعيد اليوم والإيرادات والتنبيهات'],
    en: ['Your whole clinic *on one screen*', "Today's appointments, revenue and alerts"],
  },
  patient: {
    ar: ['ملف كامل *وتنبيه طبي واضح*', 'الحساسية والأمراض المزمنة أمامك قبل أي إجراء'],
    en: ['Complete patient files, *clear medical alerts*', 'Allergies and conditions in view before any procedure'],
  },
  chart: {
    ar: ['مخطط أسنان *تفاعلي*', 'ترقيم FDI لكل سن وسطح، مع السجل الكامل'],
    en: ['An *interactive* dental chart', 'FDI numbering, every surface, full history'],
  },
  appointments: {
    ar: ['مواعيد منظّمة *لكل طبيب*', 'عرض اليوم والأسبوع والشهر، وتذكير عبر واتساب'],
    en: ["Every doctor's day, *organised*", 'Day, week and month views, WhatsApp reminders'],
  },
  treatments: {
    ar: ['خطط علاج *خطوة بخطوة*', 'ومن العمل المنجز إلى الفاتورة بضغطة'],
    en: ['Treatment plans, *step by step*', 'Turn finished work into an invoice in one tap'],
  },
  invoice: {
    ar: ['فواتير أنيقة *جاهزة للطباعة*', 'دفعات جزئية ورصيد المريض وإيصالات مرقّمة'],
    en: ['Polished invoices, *ready to print*', 'Part payments, balances and numbered receipts'],
  },
  reports: {
    ar: ['تقارير *تفهم عيادتك*', 'الإيرادات والمصروفات والربح بالطبيب والإجراء'],
    en: ['Reports that *explain your clinic*', 'Revenue, expenses and profit by doctor and procedure'],
  },
}
const TAGLINE = { ar: 'نظام إدارة عيادات الأسنان — بدون إنترنت', en: 'Dental clinic management — works offline' }
// lucide "wifi-off" (the app's icon set)
const WIFI_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg>'
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const accent = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>')

// ---- shared pieces -----------------------------------------------------------------------------------------------
const BACKDROP_CSS = `
.bg { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(180deg, #F6FCFB 0%, #E8F7F3 52%, #D4F0EA 100%) }
.bg .blob { position: absolute; border-radius: 50%; filter: blur(var(--blur, 60px)) }
.cap { position: absolute; left: 0; right: 0; text-align: center; padding: 0 var(--cap-pad, 70px); display: flex; flex-direction: column; justify-content: center }
.cap h1 { font-weight: 800; letter-spacing: -.01em; line-height: 1.32; color: #0F172A; text-wrap: balance }
.cap h1 em { font-style: normal; color: #0E8F86 }
.cap p { margin-top: .55em; font-weight: 500; color: #475569; line-height: 1.45; text-wrap: balance }
[lang="ar"] .cap h1 { font-weight: 700; letter-spacing: 0; line-height: 1.55 }
`
const backdrop = (w, h) => `<div class="bg">
  <div class="blob" style="width:${w * 0.95}px;height:${w * 0.95}px;inset-inline-end:${-w * 0.45}px;top:${h * 0.5}px;background:rgba(20,184,166,.20)"></div>
  <div class="blob" style="width:${w * 0.8}px;height:${w * 0.8}px;inset-inline-start:${-w * 0.42}px;top:${h * 0.28}px;background:rgba(116,215,198,.22)"></div>
  <div class="blob" style="--blur:${w * 0.06}px;width:${w * 0.7}px;height:${w * 0.5}px;left:${w * 0.15}px;top:${h * 0.42}px;background:rgba(255,255,255,.75)"></div>
</div>`

/** A phone around a screenshot, with an Android status bar (time on the reading side's start). */
const PHONE_CSS = `
.phone { position: absolute; background: #0B1220; padding: var(--bezel); border-radius: var(--r-out);
  box-shadow: 0 0 0 2px #273449 inset, 0 2px 0 3px rgba(255,255,255,.55), 0 70px 120px -40px rgba(9,64,60,.55), 0 30px 60px -30px rgba(15,23,42,.35) }
.phone .screen { position: relative; overflow: hidden; border-radius: var(--r-in); background: #fff }
.phone .status { height: var(--status); display: flex; align-items: center; justify-content: space-between; padding: 0 calc(var(--status) * .9);
  font: 600 calc(var(--status) * .46)/1 Inter, sans-serif; color: #0F172A; background: #fff; direction: ltr }
.phone .status .icons { display: flex; gap: calc(var(--status) * .22); align-items: center }
.phone .status svg { height: calc(var(--status) * .42); width: auto }
.phone .cam { position: absolute; top: calc(var(--status) * .27); left: 50%; width: calc(var(--status) * .46); height: calc(var(--status) * .46); margin-left: calc(var(--status) * -.23); border-radius: 50%; background: #0B1220; box-shadow: 0 0 0 3px #1F2937 }
.phone img { width: 100% }
`
const STATUS_ICONS = `<span class="icons">
  <svg viewBox="0 0 18 14"><path d="M1 13h2V9H1zm4 0h2V6H5zm4 0h2V3H9zm4 0h2V0h-2z" fill="#0F172A"/></svg>
  <svg viewBox="0 0 20 14"><path d="M10 13.5 0 3.2C2.7 1.2 6.2 0 10 0s7.3 1.2 10 3.2z" fill="#0F172A"/></svg>
  <svg viewBox="0 0 26 14"><rect x=".5" y=".5" width="22" height="13" rx="3.5" fill="none" stroke="#0F172A"/><rect x="2.5" y="2.5" width="15" height="9" rx="2" fill="#0F172A"/><rect x="23.5" y="4.5" width="2" height="5" rx="1" fill="#0F172A"/></svg>
</span>`
const phone = ({ src, width, left, top, lang }) => {
  const bezel = Math.round(width * 0.026), status = Math.round(width * 0.068)
  const time = `<span>11:40</span>`
  return `<div class="phone" style="--bezel:${bezel}px;--r-out:${Math.round(width * 0.135)}px;--r-in:${Math.round(width * 0.11)}px;--status:${status}px;width:${width}px;left:${left}px;top:${top}px">
    <div class="screen"><div class="status" style="flex-direction:${lang === 'ar' ? 'row-reverse' : 'row'}">${time}${STATUS_ICONS}</div><div class="cam"></div><img src="${pathToFileURL(src).href}"></div></div>`
}

/** A tablet around a screenshot (no status bar: the app runs full screen on tablets in the screenshots). */
const TABLET_CSS = `
.tablet { position: absolute; background: #0B1220; padding: var(--bezel); border-radius: var(--r-out);
  box-shadow: 0 0 0 2px #273449 inset, 0 2px 0 3px rgba(255,255,255,.55), 0 80px 140px -50px rgba(9,64,60,.55), 0 30px 70px -35px rgba(15,23,42,.35) }
.tablet .screen { overflow: hidden; border-radius: var(--r-in); background: #fff }
.tablet img { width: 100% }
`
const tablet = ({ src, width, left, top }) => {
  const bezel = Math.round(width * 0.022)
  return `<div class="tablet" style="--bezel:${bezel}px;--r-out:${Math.round(width * 0.055)}px;--r-in:${Math.round(width * 0.034)}px;width:${width + 2 * bezel}px;left:${left}px;top:${top}px">
    <div class="screen"><img src="${pathToFileURL(src).href}"></div></div>`
}

/** A desktop window (Windows title bar) around a screenshot. */
const WINDOW_CSS = `
.win { position: absolute; border-radius: var(--r); overflow: hidden; background: #fff; box-shadow: 0 0 0 1px rgba(15,23,42,.10), 0 60px 120px -40px rgba(9,64,60,.45), 0 24px 48px -24px rgba(15,23,42,.30) }
.win .bar { height: var(--bar); display: flex; align-items: center; gap: calc(var(--bar) * .3); padding: 0 calc(var(--bar) * .45); background: #F8FAFC; border-bottom: 1px solid #E6EAF0; direction: ltr;
  font: 600 calc(var(--bar) * .36)/1 Inter, sans-serif; color: #334155 }
.win .bar svg.logo { width: calc(var(--bar) * .5); height: calc(var(--bar) * .5) }
.win .bar .ctl { margin-left: auto; display: flex; gap: calc(var(--bar) * .7); align-items: center; padding-right: calc(var(--bar) * .15) }
.win .bar .ctl i { display: block; width: calc(var(--bar) * .3); height: calc(var(--bar) * .3); border: 2px solid #64748B; border-width: 0 0 2px }
.win .bar .ctl i.max { border-width: 2px; border-radius: 2px }
.win .bar .ctl i.x { border: 0; position: relative }
.win .bar .ctl i.x::before, .win .bar .ctl i.x::after { content: ''; position: absolute; left: 50%; top: -15%; width: 2px; height: 130%; background: #64748B; transform: rotate(45deg) }
.win .bar .ctl i.x::after { transform: rotate(-45deg) }
.win img { width: 100% }
`
const windowFrame = ({ src, width, left, top, title = 'Dentora' }) => {
  const bar = Math.round(width * 0.03)
  return `<div class="win" style="--r:${Math.round(width * 0.012)}px;--bar:${bar}px;width:${width}px;left:${left}px;top:${top}px">
    <div class="bar">${appIcon(Math.round(bar * 0.52), 60).replace('<svg ', '<svg class="logo" ')}<span>${title}</span><span class="ctl"><i></i><i class="max"></i><i class="x"></i></span></div>
    <img src="${pathToFileURL(src).href}"></div>`
}

// ---- rendering ---------------------------------------------------------------------------------------------------
let browser
async function render({ html, width, height, out, transparent = false }) {
  browser ||= await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  fs.mkdirSync(TMP, { recursive: true })
  const file = path.join(TMP, 'page.html')
  fs.writeFileSync(file, html)
  await page.goto(pathToFileURL(file).href)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(i => i.decode().catch(() => { throw new Error(`image did not load: ${i.src}`) })))
  })
  // every text block must fit its box (a few px of glyph overhang below the last line are not overflow)
  const overflow = await page.evaluate(() => [...document.querySelectorAll('[data-fit]')].filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 8).map(e => `${e.textContent.trim().slice(0, 40)} (${e.scrollWidth}×${e.scrollHeight} in ${e.clientWidth}×${e.clientHeight})`))
  if (overflow.length) throw new Error(`${path.basename(out)}: text does not fit: ${overflow.join(' | ')}`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await page.screenshot({ path: out, omitBackground: transparent })
  await page.close()
  console.log('made', path.relative(ROOT, out), `${width}×${height}`)
}
const doc = (lang, css, body, bg = '#fff') => `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>${BASE_CSS}${css}
body { position: relative; width: 100vw; height: 100vh; background: ${bg} }</style></head><body>${body}</body></html>`

// ---- 1. icon -----------------------------------------------------------------------------------------------------
async function makeIcon() {
  // the launcher icon's gradient and mark (public/icon.svg), as a full square: Play rounds the corners itself.
  // The mark is centred on the square (in icon.svg it sits a little high and to the left) and kept inside the
  // middle 60%, well within the area Play's mask always shows.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="512" height="512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#0E8F86"/></linearGradient></defs>
    <rect width="256" height="256" fill="url(#g)"/>${mark(1.04)}</svg>`
  await render({ html: doc('en', '', svg), width: 512, height: 512, out: path.join(STORE, 'icon-512.png') })
}

// ---- 2. feature graphic and link preview ---------------------------------------------------------------------------
/** Brand block + product visual (desktop window and phone), for the Play feature graphic and the og image. */
function banner(lang, w, h) {
  const ar = lang === 'ar'
  const s = w / 1024                                  // designed at 1024 wide
  const desk = path.join(SHOTS, 'desktop', lang, '01-dashboard.png')
  const tall = path.join(WORK, 'phone-tall', lang, '04-appointments.png')
  const css = `${PHONE_CSS}${WINDOW_CSS}
  .fg { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(${ar ? 250 : 110}deg, #FFFFFF 0%, #F2FBF9 42%, #DDF4EF 100%) }
  .ring { position: absolute; border-radius: 50%; border: ${2 * s}px solid rgba(14,143,134,.10) }
  .glow { position: absolute; border-radius: 50%; filter: blur(${50 * s}px); background: rgba(20,184,166,.20) }
  .brand { position: absolute; top: 0; bottom: 0; inset-inline-start: ${60 * s}px; width: ${460 * s}px; display: flex; flex-direction: column; justify-content: center; gap: ${22 * s}px }
  .lockup { display: flex; align-items: center; gap: ${20 * s}px; direction: ltr; justify-content: ${ar ? 'flex-end' : 'flex-start'} }
  .lockup svg { filter: drop-shadow(0 ${10 * s}px ${18 * s}px rgba(14,143,134,.35)); flex: none }
  .word { font: 800 ${66 * s}px/1 Inter, sans-serif; letter-spacing: -.025em; color: #0F172A }
  .tag { font-weight: 700; font-size: ${34 * s}px; line-height: ${ar ? 1.8 : 1.3}; color: #0F172A; white-space: nowrap; overflow: hidden }
  .pill { align-self: flex-start; display: inline-flex; align-items: center; gap: ${10 * s}px; padding: ${9 * s}px ${20 * s}px; border-radius: 999px; white-space: nowrap;
    background: rgba(20,184,166,.13); color: #0F716C; font-weight: 700; font-size: ${24 * s}px; line-height: 1.3; box-shadow: 0 0 0 ${1.5 * s}px rgba(14,143,134,.18) inset }
  .pill svg { width: ${26 * s}px; height: ${26 * s}px; flex: none }
  .visual { position: absolute; top: 0; bottom: 0; inset-inline-end: 0; width: ${520 * s}px }
  `
  const [main, rest] = TAGLINE[lang].split(' — ')
  const visual = ar
    ? `${windowFrame({ src: desk, width: Math.round(560 * s), left: Math.round(-150 * s), top: Math.round(96 * s) })}
       ${phone({ src: tall, width: Math.round(170 * s), left: Math.round(300 * s), top: Math.round(58 * s), lang })}`
    : `${windowFrame({ src: desk, width: Math.round(560 * s), left: Math.round(110 * s), top: Math.round(96 * s) })}
       ${phone({ src: tall, width: Math.round(170 * s), left: Math.round(50 * s), top: Math.round(58 * s), lang })}`
  const body = `<div class="fg">
    <div class="glow" style="width:${520 * s}px;height:${520 * s}px;inset-inline-end:${-60 * s}px;top:${-40 * s}px"></div>
    <div class="ring" style="width:${760 * s}px;height:${760 * s}px;inset-inline-end:${-260 * s}px;top:${-160 * s}px"></div>
    <div class="ring" style="width:${560 * s}px;height:${560 * s}px;inset-inline-end:${-160 * s}px;top:${-60 * s}px"></div>
    <div class="visual">${visual}</div>
    <div class="brand">
      <div class="lockup">${ar ? `<span class="word">Dentora</span>${appIcon(Math.round(84 * s), 60)}` : `${appIcon(Math.round(84 * s), 60)}<span class="word">Dentora</span>`}</div>
      <div class="tag${ar ? ' ar' : ''}" data-fit>${esc(main)}</div>
      <div class="pill${ar ? ' ar' : ''}" data-fit>${WIFI_OFF}<span>${esc(rest[0].toUpperCase() + rest.slice(1))}</span></div>
    </div></div>`
  return doc(lang, css, body)
}
async function makeFeature() {
  await render({ html: banner('ar', 1024, 500), width: 1024, height: 500, out: path.join(STORE, 'feature-graphic-1024x500.png') })
  await render({ html: banner('en', 1024, 500), width: 1024, height: 500, out: path.join(STORE, 'feature-graphic-1024x500-en.png') })
}

// ---- 3. framed screenshots ----------------------------------------------------------------------------------------
const screensOf = dir => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^\d\d-[a-z]+\.png$/.test(f)).sort() : [])
const keyOf = f => f.replace(/^\d\d-|\.png$/g, '')

function framePortrait(lang, file, device) {
  // 1080×1920: caption on top, the device below it
  const [title, sub] = CAPTIONS[keyOf(file)][lang]
  const W = 1080, H = 1920
  const isPhone = device === 'phone'
  const src = isPhone ? path.join(WORK, 'phone-tall', lang, file) : path.join(SHOTS, device, lang, file)
  const css = `${BACKDROP_CSS}${PHONE_CSS}${TABLET_CSS}
  .cap { top: 96px; height: 270px; --cap-pad: 76px }
  .cap h1 { font-size: ${lang === 'ar' ? 58 : 62}px }
  .cap p { font-size: ${lang === 'ar' ? 31 : 32}px }`
  const dev = isPhone
    ? phone({ src, width: 664, left: (W - 664) / 2, top: 404, lang })
    : tablet({ src, width: 752, left: (W - 752 - 2 * Math.round(752 * 0.022)) / 2, top: 404 })
  return { html: doc(lang, css, `${backdrop(W, H)}<header class="cap${lang === 'ar' ? ' ar' : ''}" data-fit><h1>${accent(title)}</h1><p>${esc(sub)}</p></header>${dev}`), width: W, height: H }
}
function frameLandscape(lang, file) {
  // 2560×1440: caption on top, the 10-inch tablet below it
  const [title, sub] = CAPTIONS[keyOf(file)][lang]
  const W = 2560, H = 1440
  const css = `${BACKDROP_CSS}${TABLET_CSS}
  .cap { top: 78px; height: 230px; --cap-pad: 160px }
  .cap h1 { font-size: ${lang === 'ar' ? 70 : 74}px }
  .cap p { font-size: 38px; margin-top: .4em }
  [lang="ar"] .cap h1 { line-height: 1.45 }`
  const width = 1700, bezel = Math.round(width * 0.022)
  const dev = tablet({ src: path.join(SHOTS, 'tablet10', lang, file), width, left: (W - width - 2 * bezel) / 2, top: 336 })
  return { html: doc(lang, css, `${backdrop(W, H)}<header class="cap${lang === 'ar' ? ' ar' : ''}" data-fit><h1>${accent(title)}</h1><p>${esc(sub)}</p></header>${dev}`), width: W, height: H }
}
async function makeFrames() {
  for (const lang of ['ar', 'en']) {
    for (const device of ['phone', 'tablet7']) {
      for (const file of screensOf(path.join(SHOTS, device, lang))) {
        await render({ ...framePortrait(lang, file, device), out: path.join(STORE, 'framed', device, lang, file) })
      }
    }
    for (const file of screensOf(path.join(SHOTS, 'tablet10', lang))) {
      await render({ ...frameLandscape(lang, file), out: path.join(STORE, 'framed', 'tablet10', lang, file) })
    }
  }
}

// ---- 4. website pictures ------------------------------------------------------------------------------------------
async function makeWeb() {
  for (const lang of ['ar', 'en']) {
    const ar = lang === 'ar'
    // hero: the Windows app with the dashboard, the phone with the day's appointments in front (transparent PNG)
    const W = 2400, H = 1500
    const css = `${PHONE_CSS}${WINDOW_CSS}`
    const winW = 2040
    const body = `${windowFrame({ src: path.join(SHOTS, 'desktop', lang, '01-dashboard.png'), width: winW, left: ar ? W - winW - 60 : 60, top: 70 })}
      ${phone({ src: path.join(WORK, 'phone-tall', lang, '04-appointments.png'), width: 560, left: ar ? 70 : W - 560 - 70, top: 196, lang })}`
    await render({ html: doc(lang, css, body, 'transparent'), width: W, height: H, out: path.join(STORE, 'web', `hero-${lang}.png`), transparent: true })
    // link preview 1200×630
    await render({ html: banner(lang, 1200, 630), width: 1200, height: 630, out: path.join(STORE, 'web', `og-${lang}.png`) })
  }
}

try {
  if (want('icon')) await makeIcon()
  if (want('feature')) await makeFeature()
  if (want('frames')) await makeFrames()
  if (want('web')) await makeWeb()
} finally {
  await browser?.close()
}
