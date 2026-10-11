// The story ad (1080×1920: Instagram, Facebook and WhatsApp stories), drawn by Chromium (Playwright) from the brand
// and the app's real screenshots, with the app's own fonts, like store/scripts/compose.mjs.
//   node store/scripts/story.mjs
// Output: store/ads/story-ar.png
// Every claim must stay true of the app and the offer (server/src/pages/content.ts, src/features/settings/seller.ts).
// Stories cover about 250 px at the top (the account name) and at the bottom (the reply bar): the brand, the offer and
// the WhatsApp number stay between them.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = path.join(ROOT, 'store/screenshots')
const OUT = path.join(ROOT, 'store/ads/story-ar.png')
const TMP = path.join(process.env.STORE_WORK || '/tmp/dentora-store-work', 'story')
const W = 1080, H = 1920

// ---- brand (as in compose.mjs) -------------------------------------------------------------------------------------
const font = f => pathToFileURL(path.join(ROOT, 'node_modules', f)).href
const FONTS = `
@font-face { font-family: Inter; src: url(${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
@font-face { font-family: Kufi; src: url(${font('@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-arabic-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
`
const ICON = fs.readFileSync(path.join(ROOT, 'public/icon.svg'), 'utf8')
const TOOTH_PATH = ICON.match(/<path d="([^"]+)"/)[1]
const SPARK = ICON.match(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/).slice(1).map(Number)
const mark = (fill = '#fff') => `<g transform="translate(3 8)"><path d="${TOOTH_PATH}" fill="${fill}" opacity=".97"/>
  <circle cx="${SPARK[0]}" cy="${SPARK[1]}" r="${SPARK[2]}" fill="${fill}" opacity=".9"/></g>`
const appIcon = (size, cls = '') => `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
  <defs><linearGradient id="ig${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#0E8F86"/></linearGradient></defs>
  <rect width="256" height="256" rx="60" fill="url(#ig${size})"/>${mark()}</svg>`

// lucide icons (the app's icon set), as the landing page draws them
const ICONS = {
  tooth: '<path d="M11.88 4.62C10.38 2.88 8.38 2.44 6.38 3.88C4.12 5.5 3.62 8.62 4.62 11.38C5.75 14.5 6.38 18.38 7.38 20.62C7.75 21.5 8.88 21.5 9.25 20.62C9.88 19.12 10.25 16.88 10.88 15.38C11.25 14.38 12.5 14.38 12.88 15.38C13.5 16.88 13.88 19.12 14.5 20.62C14.88 21.5 16 21.5 16.38 20.62C17.38 18.38 18 14.5 19.12 11.38C20.12 8.62 19.62 5.5 17.38 3.88C15.38 2.44 13.38 2.88 11.88 4.62Z"/>',
  calendarCheck: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  receipt: '<path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  infinity: '<path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  whatsapp: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path transform="translate(7.1 7.1) scale(.41)" stroke-width="4.6" d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
}
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
const src = (...p) => pathToFileURL(path.join(SHOTS, ...p)).href

// ---- the offer (src/features/settings/seller.ts, server/src/types.ts DEFAULT_SETTINGS) -----------------------------
const PRICE = 59
const WHATSAPP = '+963 996 489 504'
const SITE = 'dentora.raqeem.dev'

// ---- page ----------------------------------------------------------------------------------------------------------
const CSS = `${FONTS}
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: ${W}px; height: ${H}px; overflow: hidden }
body { position: relative; font-family: Kufi, Inter, sans-serif; color: #fff; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision;
  background: #062321 }
.lat { font-family: Inter, Kufi, sans-serif }
img { display: block }
.i { width: 1em; height: 1em; flex: none }

/* backdrop: deep teal, a glow behind the devices and a fading dot grid */
.bg { position: absolute; inset: 0; overflow: hidden;
  background: radial-gradient(130% 62% at 50% 0%, #0E4A46 0%, #08302D 46%, #051C1B 100%) }
.bg .glow { position: absolute; border-radius: 50%; filter: blur(110px) }
.bg .dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.085) 1.6px, transparent 1.8px); background-size: 34px 34px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 38%, transparent 62%) }

/* brand row */
.brand { position: absolute; top: 196px; inset-inline: 64px; display: flex; align-items: center; justify-content: space-between }
.logo { display: flex; align-items: center; gap: 22px }
.logo svg { filter: drop-shadow(0 14px 26px rgba(0,0,0,.35)) }
.logo b { display: block; font: 800 54px/1 Inter, sans-serif; letter-spacing: -.025em; direction: ltr; text-align: right }
.logo small { display: block; margin-top: 12px; font-size: 24px; font-weight: 600; line-height: 1.2; color: #7EE3D2 }
.os { display: flex; align-items: center; gap: 16px; padding: 14px 24px; border-radius: 999px; font-size: 24px; font-weight: 600;
  background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.16) }
.os span { display: flex; align-items: center; gap: 9px }
.os .i { font-size: 28px; color: #7EE3D2 }
.os em { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.35) }

/* headline */
.head { position: absolute; top: 322px; inset-inline: 56px; text-align: center }
.head h1 { font-size: 92px; font-weight: 800; line-height: 1.38; letter-spacing: 0; text-shadow: 0 6px 30px rgba(0,0,0,.25) }
.head h1 em { font-style: normal; background: linear-gradient(90deg, #A7F3E4 0%, #5EEAD4 45%, #2DD4BF 100%); -webkit-background-clip: text; background-clip: text; color: transparent }
.head p { margin-top: 18px; font-size: 31px; font-weight: 500; line-height: 1.5; color: rgba(255,255,255,.80) }
.head p i { font-style: normal; color: #5EEAD4; padding: 0 .35em }

/* devices */
.win { position: absolute; border-radius: 14px; overflow: hidden; background: #fff;
  box-shadow: 0 0 0 1.5px rgba(255,255,255,.18), 0 60px 110px -30px rgba(0,0,0,.65), 0 24px 50px -20px rgba(0,0,0,.45) }
.win .bar { height: 30px; display: flex; align-items: center; padding: 0 13px; background: #F8FAFC; border-bottom: 1px solid #E6EAF0; direction: ltr }
.win .bar .ctl { margin-left: auto; display: flex; gap: 18px; padding-right: 6px }
.win .bar .ctl i { display: block; width: 10px; height: 10px; border: 1.6px solid #64748B; border-width: 0 0 1.6px }
.win .bar .ctl i.max { border-width: 1.6px; border-radius: 2px }
.win img { width: 100% }
.phone { position: absolute; background: #0B1220; padding: 9px; border-radius: 46px;
  box-shadow: 0 0 0 2px #273449 inset, 0 0 0 2.5px rgba(255,255,255,.22), 0 70px 120px -30px rgba(0,0,0,.75), 0 30px 60px -24px rgba(0,0,0,.55) }
.phone .screen { position: relative; overflow: hidden; border-radius: 37px; background: #fff }
.phone .status { height: 24px; display: flex; flex-direction: row-reverse; align-items: center; justify-content: space-between; padding: 0 22px;
  font: 600 11px/1 Inter, sans-serif; color: #0F172A; background: #fff; direction: ltr }
.phone .status .icons { display: flex; gap: 5px; align-items: center }
.phone .status svg { height: 10px; width: auto }
.phone .cam { position: absolute; top: 6px; left: 50%; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: #0B1220 }
.phone img { width: 100% }

/* feature chips floating over the devices */
.chip { position: absolute; display: flex; align-items: center; gap: 14px; padding: 14px 22px 14px 18px; border-radius: 22px; white-space: nowrap;
  background: rgba(255,255,255,.97); color: #0F172A; font-size: 25px; font-weight: 700; line-height: 1.3;
  box-shadow: 0 24px 50px -16px rgba(0,0,0,.55), 0 0 0 1px rgba(15,23,42,.06) }
.chip .ic { width: 50px; height: 50px; border-radius: 15px; display: grid; place-items: center; font-size: 28px; flex: none }
.chip .ic.teal { background: #D4F5EE; color: #0F716C }
.chip .ic.green { background: #DCFCE7; color: #15803D }
.chip .ic.indigo { background: #EEF2FF; color: #4F46E5 }
.chip .ic.amber { background: #FEF3C7; color: #B45309 }

/* the offer */
.offer { position: absolute; top: 1392px; inset-inline: 56px; height: 196px; display: flex; align-items: center; gap: 34px; padding: 0 40px;
  border-radius: 36px; background: linear-gradient(135deg, rgba(255,255,255,.13), rgba(255,255,255,.05));
  box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18), 0 30px 60px -30px rgba(0,0,0,.5); backdrop-filter: blur(8px) }
.price { flex: none; text-align: center }
.price small { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 24px; font-weight: 700; color: #7EE3D2; line-height: 1.2 }
.price small .i { font-size: 30px }
.price b { display: block; margin-top: 4px; direction: ltr; font: 900 116px/1 Inter, sans-serif; letter-spacing: -.04em }
.price b sup { font-size: .46em; font-weight: 800; vertical-align: .95em; margin-left: 4px; color: #5EEAD4; letter-spacing: 0 }
.sep { width: 1.5px; align-self: stretch; margin: 34px 0; background: rgba(255,255,255,.18) }
.ticks { list-style: none; display: grid; gap: 12px; font-size: 25px; font-weight: 600; line-height: 1.35 }
.ticks li { display: flex; align-items: center; gap: 12px }
.ticks li .i { width: 32px; height: 32px; padding: 6px; border-radius: 50%; background: #14B8A6; color: #04201E; stroke-width: 3.2 }

/* call to action */
.cta { position: absolute; top: 1616px; inset-inline: 56px; height: 112px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 14px 0 34px; padding-inline: 30px 14px; border-radius: 999px; background: linear-gradient(180deg, #2EE07A, #1EBE5D);
  box-shadow: 0 26px 50px -18px rgba(30,190,93,.65), inset 0 2px 0 rgba(255,255,255,.35); color: #fff }
.cta .go { display: flex; align-items: center; gap: 16px; font-size: 33px; font-weight: 800; line-height: 1.2; text-shadow: 0 2px 6px rgba(0,80,30,.25) }
.cta .go .i { font-size: 48px; stroke-width: 2.1 }
.cta .num { direction: ltr; padding: 20px 28px; border-radius: 999px; background: #0B2E1C; color: #fff; font: 700 33px/1 Inter, sans-serif; letter-spacing: .01em }
.site { position: absolute; top: 1752px; inset-inline: 0; display: flex; align-items: center; justify-content: center; gap: 12px;
  font: 600 27px/1 Inter, sans-serif; color: rgba(255,255,255,.78); direction: ltr }
.site .i { font-size: 28px; color: #5EEAD4 }
`

const STATUS_ICONS = `<span class="icons">
  <svg viewBox="0 0 18 14"><path d="M1 13h2V9H1zm4 0h2V6H5zm4 0h2V3H9zm4 0h2V0h-2z" fill="#0F172A"/></svg>
  <svg viewBox="0 0 20 14"><path d="M10 13.5 0 3.2C2.7 1.2 6.2 0 10 0s7.3 1.2 10 3.2z" fill="#0F172A"/></svg>
  <svg viewBox="0 0 26 14"><rect x=".5" y=".5" width="22" height="13" rx="3.5" fill="none" stroke="#0F172A"/><rect x="2.5" y="2.5" width="15" height="9" rx="2" fill="#0F172A"/><rect x="23.5" y="4.5" width="2" height="5" rx="1" fill="#0F172A"/></svg>
</span>`

// geometry: the desktop window (dental chart) on the left, the phone (dashboard) over the window's sidebar on the right
const WIN = { left: 40, top: 724, width: 930 }
const PHONE = { left: 742, top: 792, width: 300 }

const body = `
<div class="bg">
  <div class="glow" style="width:980px;height:760px;left:50px;top:760px;background:rgba(20,184,166,.36)"></div>
  <div class="glow" style="width:620px;height:620px;left:560px;top:-180px;background:rgba(94,234,212,.16)"></div>
  <div class="glow" style="width:520px;height:420px;left:-200px;top:1420px;background:rgba(30,190,93,.14)"></div>
  <div class="dots"></div>
</div>

<header class="brand">
  <div class="logo">${appIcon(96)}<div><b>Dentora</b><small>لإدارة عيادات الأسنان</small></div></div>
  <div class="os"><span>${icon('monitor')}ويندوز</span><em></em><span>${icon('smartphone')}أندرويد</span></div>
</header>

<section class="head" data-fit>
  <h1>عيادة الأسنان كلها<br><em>في برنامج واحد</em></h1>
  <p>المرضى<i>·</i>المواعيد<i>·</i>مخطط الأسنان<i>·</i>الفواتير<i>·</i>التقارير</p>
</section>

<div class="win" style="left:${WIN.left}px;top:${WIN.top}px;width:${WIN.width}px">
  <div class="bar"><span class="ctl"><i></i><i class="max"></i><i></i></span></div>
  <img src="${src('desktop/ar/03-chart.png')}">
</div>
<div class="phone" style="left:${PHONE.left}px;top:${PHONE.top}px;width:${PHONE.width}px">
  <div class="screen"><div class="status"><span>11:40</span>${STATUS_ICONS}</div><div class="cam"></div><img src="${src('phone/ar/01-dashboard.png')}"></div>
</div>

<div class="chip" style="left:24px;top:668px"><span class="ic teal">${icon('tooth')}</span>مخطط أسنان تفاعلي</div>
<div class="chip" style="left:96px;top:1196px"><span class="ic green">${icon('calendarCheck')}</span>تذكير المواعيد عبر واتساب</div>
<div class="chip" style="left:556px;top:1286px"><span class="ic indigo">${icon('receipt')}</span>فواتير وتقارير</div>

<section class="offer">
  <div class="price"><small>${icon('infinity')}ترخيص مدى الحياة</small><b>${PRICE}<sup>$</sup></b></div>
  <div class="sep"></div>
  <ul class="ticks" data-fit>
    <li>${icon('check')}دفعة واحدة، بلا اشتراك شهري</li>
    <li>${icon('check')}جرّبه مجاناً 7 أيام بكل المزايا</li>
    <li>${icon('check')}يعمل دون إنترنت، وبياناتك عندك</li>
  </ul>
</section>

<div class="cta">
  <span class="go">${icon('whatsapp')}اطلبه الآن عبر واتساب</span>
  <span class="num">${WHATSAPP}</span>
</div>
<div class="site">${icon('globe')}${SITE}</div>
`

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  fs.mkdirSync(TMP, { recursive: true })
  const file = path.join(TMP, 'story.html')
  fs.writeFileSync(file, html)
  await page.goto(pathToFileURL(file).href)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(i => i.decode().catch(() => { throw new Error(`image did not load: ${i.src}`) })))
  })
  // every text block fits its box, and nothing important leaves the canvas
  const problems = await page.evaluate(([w]) => [
    ...[...document.querySelectorAll('[data-fit], .chip, .cta, .offer, .brand')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => `overflows: ${e.textContent.trim().slice(0, 40)}`),
    ...[...document.querySelectorAll('.chip, .cta, .offer, .brand, .head, .site')].filter(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > w }).map(e => `off canvas: ${e.textContent.trim().slice(0, 40)}`),
  ], [W])
  if (problems.length) throw new Error(problems.join(' | '))
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await page.screenshot({ path: OUT })
  console.log('made', path.relative(ROOT, OUT), `${W}×${H}`)
} finally { await browser.close() }
