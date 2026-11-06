// The promo video ad: stories (1080×1920: Instagram, Facebook, WhatsApp status, TikTok) and the square feed (1080×1080).
// Real footage of the app from the video course (store/voiceover/final/<chapter>.mp4, the phone shot from
// store/screenshots/phone/ar/), the Gemini narration in the course's voice, captions burned in (most people watch
// muted), and the closing offer as on store/ads/story-ar.png. Drawn by Chromium (Playwright) with the app's fonts and
// the brand of store/scripts/story.mjs, assembled by ffmpeg.
//   node store/scripts/ad-video.mjs [--formats=story,square]
// Inputs (store/ads/video/): script.json { sentences: [{ text, spoken, headline, chip, shot }] } (text = the caption,
// spoken = what the voice read), narration.wav (one Gemini TTS request, voice ar-001-training-2) and the sentence
// timing, store/voiceover/narration/ar/ad-promo/report.json (split.mjs: each sentence's speech start and end).
// Output: store/ads/video/dentora-ad-<format>-ar.mp4 (H.264 30 fps yuv420p, AAC 192k 48 kHz, -14 LUFS) and a cover
// frame dentora-ad-<format>-ar.jpg. Every claim must stay true of the app and the offer (server/src/pages/content.ts).
// Stories cover about 250 px at the top (the account name) and at the bottom (the reply bar): text stays between them.
import { chromium } from 'playwright'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DIR = path.join(ROOT, 'store/ads/video')
const VO = path.join(ROOT, 'store/voiceover')
const TMP = path.join(process.env.STORE_WORK || '/tmp/dentora-store-work', 'ad-video')
const FORMATS = (process.argv.find(a => a.startsWith('--formats=')) || '--formats=story,square').split('=')[1].split(',')
const FPS = 30, LEAD = 0.45, HOLD = 2.2, FADE = 0.35, ZOOM = 0.06

// ---- the offer (server/src/types.ts DEFAULT_SETTINGS, as story.mjs) -------------------------------------------------
const PRICE = 59
const WHATSAPP = '+963 996 489 504'
const SITE = 'dentora.raqeem.dev'

// ---- the footage of each shot: a course chapter and the second it starts (its scene + offset), the region to show in
// source pixels of the 1920×1080 recording: its right edge (Arabic lines start on the right: the region ends at the app's
// content edge, before the sidebar, with a margin), its width, and its top per format (the height follows the window).
// The slow zoom is anchored at the top right, so the start of every line stays in the frame. The phone shot is a real
// phone screenshot of the app.
const FOOT = {
  dashboard: { slug: 'dashboard', scene: 'overview', offset: 0.5, right: 1495, width: 1470, top: { story: 92, square: 92 } },
  patient: { slug: 'patients', scene: 'files-tab', offset: 1.0, right: 1500, width: 1470, top: { story: 100, square: 150 } },
  chart: { slug: 'chart', scene: 'paint-surfaces', offset: 0.3, right: 1495, width: 1470, top: { story: 95, square: 200 } },
  appointments: { slug: 'appointments', scene: 'views', offset: 0.3, right: 1500, width: 1470, top: { story: 90, square: 120 } },
  whatsapp: { slug: 'appointments', scene: 'reminder', offset: 0.3, right: 1500, width: 1160, top: { story: 280, square: 290 } },
  invoice: { slug: 'billing', scene: 'from-treatments', offset: 2.0, right: 1730, width: 1560, top: { story: 20, square: 40 } },
  prescription: { slug: 'prescriptions', scene: 'sheet', offset: 0.3, right: 1560, width: 1240, top: { story: 40, square: 60 } },
  reports: { slug: 'reports', scene: 'charts', offset: 0.3, right: 1500, width: 1470, top: { story: 90, square: 120 } },
  backup: { slug: 'backup', scene: 'protect-export', offset: 0.5, right: 1500, width: 1470, top: { story: 90, square: 120 } },
  phone: { image: 'store/screenshots/phone/ar/01-dashboard.png' },
}

// ---- brand (as store/scripts/story.mjs) -----------------------------------------------------------------------------
const font = f => pathToFileURL(path.join(ROOT, 'node_modules', f)).href
const FONTS = `
@font-face { font-family: Inter; src: url(${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
@font-face { font-family: Kufi; src: url(${font('@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-arabic-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }`
const ICON = fs.readFileSync(path.join(ROOT, 'public/icon.svg'), 'utf8')
const TOOTH_PATH = ICON.match(/<path d="([^"]+)"/)[1]
const SPARK = ICON.match(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/).slice(1).map(Number)
const appIcon = size => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
  <defs><linearGradient id="ig${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#0E8F86"/></linearGradient></defs>
  <rect width="256" height="256" rx="60" fill="url(#ig${size})"/><g transform="translate(3 8)"><path d="${TOOTH_PATH}" fill="#fff" opacity=".97"/>
  <circle cx="${SPARK[0]}" cy="${SPARK[1]}" r="${SPARK[2]}" fill="#fff" opacity=".9"/></g></svg>`
const ICONS = {   // lucide, the app's icon set
  tooth: '<path d="M11.88 4.62C10.38 2.88 8.38 2.44 6.38 3.88C4.12 5.5 3.62 8.62 4.62 11.38C5.75 14.5 6.38 18.38 7.38 20.62C7.75 21.5 8.88 21.5 9.25 20.62C9.88 19.12 10.25 16.88 10.88 15.38C11.25 14.38 12.5 14.38 12.88 15.38C13.5 16.88 13.88 19.12 14.5 20.62C14.88 21.5 16 21.5 16.38 20.62C17.38 18.38 18 14.5 19.12 11.38C20.12 8.62 19.62 5.5 17.38 3.88C15.38 2.44 13.38 2.88 11.88 4.62Z"/>',
  calendarCheck: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  receipt: '<path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  infinity: '<path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  whatsapp: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path transform="translate(7.1 7.1) scale(.41)" stroke-width="4.6" d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  barChart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  layout: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
}
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
const SHOT_ICON = { dashboard: ['layout', 'teal'], patient: ['users', 'teal'], chart: ['tooth', 'teal'], appointments: ['calendarCheck', 'teal'],
  whatsapp: ['whatsapp', 'green'], invoice: ['receipt', 'indigo'], prescription: ['fileText', 'indigo'], reports: ['barChart', 'amber'],
  backup: ['database', 'teal'], phone: ['smartphone', 'teal'] }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/(\d+(?:[.,]\d+)?\s?\$)/g, '\u2066$1\u2069')   // a price reads "59$" inside Arabic text (as the site's ⁦59$⁩), not "$59" 

// ---- layout per format: where the window (or the phone) is, sizes of the texts ----------------------------------------
const LAYOUT = {
  story: { W: 1080, H: 1920, brandTop: 282, logo: 92, name: 52, head: { top: 396, size: 72, max: 196 },
    win: { left: 40, top: 640, width: 1000, bar: 34, height: 660 }, chip: 27,
    caption: { top: 1360, size: 38, max: 168 }, strip: { top: 1546, size: 25 },
    phone: { width: 399, top: 640 } },
  square: { W: 1080, H: 1080, brandTop: 30, logo: 64, name: 38, head: { top: 104, size: 50, max: 72 },
    win: { left: 70, top: 226, width: 940, bar: 28, height: 526 }, chip: 23,
    caption: { top: 798, size: 32, max: 112 }, strip: { top: 928, size: 21 },
    phone: { width: 320, top: 226 } },
}

function css(L) {
  return `${FONTS}
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: ${L.W}px; height: ${L.H}px; overflow: hidden; background: transparent }
body { position: relative; font-family: Kufi, Inter, sans-serif; color: #fff; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision }
.i { width: 1em; height: 1em; flex: none }
.bg { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(130% 62% at 50% 0%, #0E4A46 0%, #08302D 46%, #051C1B 100%) }
.bg .glow { position: absolute; border-radius: 50%; filter: blur(110px) }
.bg .dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.085) 1.6px, transparent 1.8px); background-size: 34px 34px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 38%, transparent 62%) }
.brand { position: absolute; top: ${L.brandTop}px; inset-inline: ${L.W === L.H ? 48 : 64}px; display: flex; align-items: center; justify-content: space-between }
.logo { display: flex; align-items: center; gap: ${Math.round(L.logo * 0.22)}px }
.logo svg { filter: drop-shadow(0 14px 26px rgba(0,0,0,.35)) }
.logo b { display: block; font: 800 ${L.name}px/1 Inter, sans-serif; letter-spacing: -.025em; direction: ltr; text-align: right }
.logo small { display: block; margin-top: ${Math.round(L.name * 0.2)}px; font-size: ${Math.round(L.name * 0.44)}px; font-weight: 600; line-height: 1.2; color: #7EE3D2 }
.os { display: flex; align-items: center; gap: 14px; padding: ${Math.round(L.name * 0.24)}px ${Math.round(L.name * 0.42)}px; border-radius: 999px;
  font-size: ${Math.round(L.name * 0.44)}px; font-weight: 600; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.16) }
.os span { display: flex; align-items: center; gap: 8px }
.os .i { font-size: 1.15em; color: #7EE3D2 }
.os em { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.35) }
.head { position: absolute; top: ${L.head.top}px; inset-inline: 44px; height: ${L.head.max}px; display: flex; align-items: center; justify-content: center; text-align: center }
.head h1 { font-size: ${L.head.size}px; font-weight: 800; line-height: 1.36; text-shadow: 0 6px 30px rgba(0,0,0,.25) }
.head h1 em { font-style: normal; background: linear-gradient(90deg, #A7F3E4 0%, #5EEAD4 45%, #2DD4BF 100%); -webkit-background-clip: text; background-clip: text; color: transparent }
.win { position: absolute; left: ${L.win.left}px; top: ${L.win.top}px; width: ${L.win.width}px; height: ${L.win.bar + L.win.height}px; border-radius: 16px; background: #fff;
  box-shadow: 0 0 0 1.5px rgba(255,255,255,.18), 0 60px 110px -30px rgba(0,0,0,.65), 0 24px 50px -20px rgba(0,0,0,.45) }
.win .bar { height: ${L.win.bar}px; display: flex; align-items: center; padding: 0 14px; background: #F8FAFC; border-bottom: 1px solid #E6EAF0; border-radius: 16px 16px 0 0; direction: ltr }
.win .bar .ctl { margin-left: auto; display: flex; gap: 18px; padding-right: 6px }
.win .bar .ctl i { display: block; width: 10px; height: 10px; border: 1.6px solid #64748B; border-width: 0 0 1.6px }
.win .bar .ctl i.max { border-width: 1.6px; border-radius: 2px }
.phone { position: absolute; left: ${(L.W - L.phone.width) / 2}px; top: ${L.phone.top}px; width: ${L.phone.width}px; background: #0B1220; padding: 10px; border-radius: ${Math.round(L.phone.width * 0.13)}px;
  box-shadow: 0 0 0 2px #273449 inset, 0 0 0 2.5px rgba(255,255,255,.22), 0 70px 120px -30px rgba(0,0,0,.75), 0 30px 60px -24px rgba(0,0,0,.55) }
.phone .screen { width: 100%; height: 100%; border-radius: ${Math.round(L.phone.width * 0.105)}px; background: #fff }
.chip { position: absolute; top: ${L.chipTop}px; display: flex; align-items: center; gap: 14px; padding: 12px 22px 12px 16px; border-radius: 22px; white-space: nowrap;
  background: rgba(255,255,255,.97); color: #0F172A; font-size: ${L.chip}px; font-weight: 700; line-height: 1.3;
  box-shadow: 0 24px 50px -16px rgba(0,0,0,.55), 0 0 0 1px rgba(15,23,42,.06) }
.chip .ic { width: ${Math.round(L.chip * 1.9)}px; height: ${Math.round(L.chip * 1.9)}px; border-radius: 15px; display: grid; place-items: center; font-size: ${Math.round(L.chip * 1.1)}px; flex: none }
.chip .ic.teal { background: #D4F5EE; color: #0F716C } .chip .ic.green { background: #DCFCE7; color: #15803D }
.chip .ic.indigo { background: #EEF2FF; color: #4F46E5 } .chip .ic.amber { background: #FEF3C7; color: #B45309 }
.cap { position: absolute; top: ${L.caption.top}px; inset-inline: 48px; height: ${L.caption.max}px; display: flex; align-items: center; justify-content: center; text-align: center }
.cap p { font-size: ${L.caption.size}px; font-weight: 700; line-height: 1.5; color: #fff; text-shadow: 0 3px 14px rgba(0,0,0,.45); text-wrap: balance }
.strip { position: absolute; top: ${L.strip.top}px; inset-inline: 0; display: flex; justify-content: center }
.strip span { display: flex; align-items: center; gap: 12px; padding: 10px 24px; border-radius: 999px; font-size: ${L.strip.size}px; font-weight: 700;
  background: rgba(255,255,255,.10); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18); color: #E6FFFA }
.strip .site { font-family: Inter, sans-serif; direction: ltr; color: #7EE3D2 }
.strip em { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.4) }
/* the closing card */
.end { position: absolute; inset: 0 }
.end .ehead { position: absolute; inset-inline: 44px; text-align: center }
.end .ehead h1 { font-weight: 800; line-height: 1.32 }
.end .ehead h1 em { font-style: normal; background: linear-gradient(90deg, #A7F3E4 0%, #5EEAD4 45%, #2DD4BF 100%); -webkit-background-clip: text; background-clip: text; color: transparent }
.offer { position: absolute; display: flex; align-items: center; gap: 30px; padding: 0 36px; border-radius: 34px;
  background: linear-gradient(135deg, rgba(255,255,255,.13), rgba(255,255,255,.05)); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18), 0 30px 60px -30px rgba(0,0,0,.5) }
.price { flex: none; text-align: center }
.price small { display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700; color: #7EE3D2; line-height: 1.2 }
.price b { display: block; margin-top: 4px; direction: ltr; font-family: Inter, sans-serif; font-weight: 900; line-height: 1; letter-spacing: -.04em }
.price b sup { font-size: .46em; font-weight: 800; vertical-align: .95em; margin-left: 4px; color: #5EEAD4; letter-spacing: 0 }
.sep { width: 1.5px; align-self: stretch; margin: 30px 0; background: rgba(255,255,255,.18) }
.ticks { list-style: none; display: grid; gap: 10px; font-weight: 600; line-height: 1.35 }
.ticks li { display: flex; align-items: center; gap: 12px }
.ticks li .i { width: 1.25em; height: 1.25em; padding: .22em; border-radius: 50%; background: #14B8A6; color: #04201E; stroke-width: 3.2 }
.cta { position: absolute; display: flex; align-items: center; justify-content: space-between; padding-inline: 28px 12px; border-radius: 999px;
  background: linear-gradient(180deg, #2EE07A, #1EBE5D); box-shadow: 0 26px 50px -18px rgba(30,190,93,.65), inset 0 2px 0 rgba(255,255,255,.35); color: #fff }
.cta .go { display: flex; align-items: center; gap: 14px; font-weight: 800; line-height: 1.2; text-shadow: 0 2px 6px rgba(0,80,30,.25) }
.cta .go .i { font-size: 1.45em; stroke-width: 2.1 }
.cta .num { direction: ltr; border-radius: 999px; background: #0B2E1C; color: #fff; font-family: Inter, sans-serif; font-weight: 700; line-height: 1; letter-spacing: .01em }
.offer.hl { box-shadow: inset 0 0 0 2.5px #5EEAD4, 0 0 0 10px rgba(94,234,212,.12), 0 30px 70px -20px rgba(20,184,166,.55) }
.cta.hl { box-shadow: 0 0 0 12px rgba(46,224,122,.20), 0 0 0 26px rgba(46,224,122,.08), 0 26px 50px -18px rgba(30,190,93,.75), inset 0 2px 0 rgba(255,255,255,.35) }
.trial { position: absolute; inset-inline: 0; display: flex; justify-content: center }
.trial span { display: flex; align-items: center; gap: 14px; padding: .45em 1.1em; border-radius: 999px; font-weight: 700; color: #fff;
  background: rgba(20,184,166,.16); box-shadow: inset 0 0 0 2px rgba(94,234,212,.55) }
.trial .i { color: #5EEAD4; font-size: 1.15em }
.trial b { font-family: Inter, sans-serif; direction: ltr; color: #A7F3E4; font-weight: 700 }
.pstatus { position: absolute; display: flex; align-items: center; justify-content: space-between; direction: ltr; color: #0F172A; font: 600 15px/1 Inter, sans-serif }
.pstatus .icons { display: flex; gap: 7px; align-items: center }
.pstatus .i { width: 15px; height: 15px; stroke-width: 2.4 }
.phome { position: absolute; height: 5px; border-radius: 3px; background: #0F172A }
.site2 { position: absolute; inset-inline: 0; display: flex; align-items: center; justify-content: center; gap: 12px; font-family: Inter, sans-serif; font-weight: 600; color: rgba(255,255,255,.8); direction: ltr }
.site2 .i { color: #5EEAD4 }
`
}

const background = L => `<div class="bg">
  <div class="glow" style="width:${L.W * 0.9}px;height:${L.H * 0.4}px;left:${L.W * 0.05}px;top:${L.H * 0.36}px;background:rgba(20,184,166,.30)"></div>
  <div class="glow" style="width:${L.W * 0.57}px;height:${L.W * 0.57}px;left:${L.W * 0.52}px;top:${-L.W * 0.17}px;background:rgba(94,234,212,.16)"></div>
  <div class="glow" style="width:${L.W * 0.48}px;height:${L.W * 0.39}px;left:${-L.W * 0.19}px;top:${L.H * 0.72}px;background:rgba(30,190,93,.12)"></div>
  <div class="dots"></div></div>`
const brand = L => `<header class="brand">
  <div class="logo">${appIcon(L.logo)}<div><b>Dentora</b><small>لإدارة عيادات الأسنان</small></div></div>
  <div class="os"><span>${icon('monitor')}ويندوز</span><em></em><span>${icon('smartphone')}أندرويد</span></div></header>`
/** A headline: its second half in the brand gradient, on a second line (stories) or the same line (square). */
function headline(text, oneLine = false) {
  const words = esc(text).split(/\s+/)
  if (words.length < 2) return `<em>${words.join(' ')}</em>`
  const k = Math.ceil(words.length / 2)
  return `${words.slice(0, k).join(' ')}${oneLine ? ' ' : '<br>'}<em>${words.slice(k).join(' ')}</em>`
}

/** The phone's screen rectangle (inside the bezel), 9:16. */
const phoneScreen = L => { const w = L.phone.width - 20; return { x: (L.W - L.phone.width) / 2 + 10, y: L.phone.top + 10, w, h: Math.round(w * 16 / 9), r: Math.round(L.phone.width * 0.105) } }

/** The layers of one shot: bg (opaque: everything under the footage), fg (transparent: what lies over it), the footage rect. */
function shotPages(L, seg) {
  const isPhone = seg.shot === 'phone'
  const [ic, tone] = SHOT_ICON[seg.shot] || ['tooth', 'teal']
  const rect = isPhone ? phoneScreen(L) : { x: L.win.left, y: L.win.top + L.win.bar, w: L.win.width, h: L.win.height, r: 16 }
  const frame = isPhone
    ? `<div class="phone" style="height:${rect.h + 20}px"><div class="screen"></div></div>`
    : `<div class="win"><div class="bar"><span class="ctl"><i></i><i class="max"></i><i></i></span></div></div>`
  const chipH = Math.round(L.chip * 1.9) + 24
  // the chip sits on the window's top edge (over its bar, not over the footage); beside the phone on the phone shot
  const chipPos = isPhone ? `left:${Math.max(24, rect.x - 190)}px;top:${Math.round(rect.y + rect.h * 0.55)}px`
    : `${seg.index % 2 ? `left:${L.win.left + 28}px` : `right:${L.win.left + 28}px`};top:${L.win.top - Math.round(chipH / 2)}px`
  const bg = `${background(L)}${brand(L)}
    <section class="head" data-fit><h1>${headline(seg.headline, L.W === L.H)}</h1></section>
    ${frame}
    <section class="cap" data-fit><p>${esc(seg.text)}</p></section>
    <div class="strip"><span>جرّبه مجاناً ⁦7⁩ أيام<em></em><b class="site">${SITE}</b></span></div>`
  // an offline phone: the status bar shows airplane mode (Dentora works without internet), a home indicator below
  const band = Math.round(rect.h * PHONE_TOP), bottom = Math.round(rect.h * PHONE_BOTTOM)
  const status = isPhone ? `<div class="pstatus" style="left:${rect.x + 22}px;top:${rect.y}px;width:${rect.w - 44}px;height:${band}px">
      <span>9:41</span><span class="icons">${icon('plane')}${icon('wifiOff')}</span></div>
      <div class="phome" style="left:${rect.x + rect.w * 0.34}px;width:${rect.w * 0.32}px;top:${rect.y + rect.h - Math.round(bottom * 0.62)}px"></div>` : ''
  const fg = `${status}<div class="chip" style="${chipPos}"><span class="ic ${tone}">${icon(ic)}</span>${esc(seg.chip)}</div>`
  return { bg, fg, rect }
}
const PHONE_TOP = 0.055, PHONE_BOTTOM = 0.03   // the phone screen's status bar and home indicator bands

function endPage(L, seg) {
  const s = L.W === L.H
  const k = s ? 0.95 : 1
  const y = s ? { head: 146, headH: 110, offer: 290, cta: 538, site: 682, cap: 772, capH: 150, capSize: 32, trial: 28 }
              : { head: 446, headH: 280, offer: 762, cta: 1032, site: 1182, cap: 1290, capH: 200, capSize: 38, trial: 31 }
  const offerHl = seg.endState === 0 ? ' hl' : '', ctaHl = seg.endState === 0 ? '' : ' hl'
  return `${background(L)}${brand(L)}<div class="end">
    <section class="ehead" data-fit style="top:${y.head}px;height:${y.headH}px;display:flex;align-items:center;justify-content:center"><h1 style="font-size:${Math.round((s ? 64 : 84))}px">${headline(seg.headline, s)}</h1></section>
    <div class="offer${offerHl}" style="top:${y.offer}px;inset-inline:${s ? 64 : 56}px;height:${Math.round(220 * k)}px">
      <div class="price"><small style="font-size:${Math.round(25 * k)}px">${icon('infinity')}ترخيص مدى الحياة</small><b style="font-size:${Math.round(124 * k)}px">${PRICE}<sup>$</sup></b></div>
      <div class="sep"></div>
      <ul class="ticks" style="font-size:${Math.round(27 * k)}px"><li>${icon('check')}دفعة واحدة، بلا اشتراك شهري</li><li>${icon('check')}جرّبه مجاناً ⁦7⁩ أيام بكل المزايا</li><li>${icon('check')}يعمل دون إنترنت، وبياناتك عندك</li></ul>
    </div>
    <div class="cta${ctaHl}" style="top:${y.cta}px;inset-inline:${s ? 64 : 56}px;height:${Math.round(112 * k)}px">
      <span class="go" style="font-size:${Math.round(34 * k)}px">${icon('whatsapp')}اطلبه الآن على واتساب</span>
      <span class="num" style="font-size:${Math.round(33 * k)}px;padding:${Math.round(20 * k)}px ${Math.round(28 * k)}px">${WHATSAPP}</span>
    </div>
    <div class="trial" style="top:${y.site}px;font-size:${y.trial}px"><span>${icon('globe')}جرّبه مجاناً:<b>${SITE}</b></span></div>
    <section class="cap" style="top:${y.cap}px;height:${y.capH}px" data-fit><p style="font-size:${y.capSize}px;color:#CFFAF1">${esc(seg.text)}</p></section>
    </div>`
}

// ---- rendering the layers -------------------------------------------------------------------------------------------
async function shoot(browser, L, body, file, { transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: 1 })
  const html = path.join(TMP, path.basename(file).replace(/\.png$/, '.html'))
  fs.writeFileSync(html, `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css(L)}</style></head><body>${body}</body></html>`)
  await page.goto(pathToFileURL(html).href)
  await page.evaluate(async () => { await document.fonts.ready })
  // shrink a text block that does not fit its box, then fail if it still does not
  const problems = await page.evaluate(([w]) => {
    for (const box of document.querySelectorAll('[data-fit]')) {
      const t = box.firstElementChild
      let size = parseFloat(getComputedStyle(t).fontSize)
      while ((t.scrollHeight > box.clientHeight + 1 || t.scrollWidth > box.clientWidth + 1) && size > 16) { size -= 1; t.style.fontSize = size + 'px' }
    }
    return [...document.querySelectorAll('[data-fit], .chip, .cta, .offer, .brand, .strip span')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > w + 1 || e.scrollWidth > e.clientWidth + 1 || (e.dataset.fit !== undefined && e.firstElementChild.scrollHeight > e.clientHeight + 1) })
      .map(e => { const r = e.getBoundingClientRect(), c = e.firstElementChild; return `${e.className} [${Math.round(r.left)}..${Math.round(r.right)} sw ${e.scrollWidth}/${e.clientWidth}${c ? ` ch ${c.scrollHeight}/${e.clientHeight}` : ''}]: ${e.textContent.trim().slice(0, 50)}` })
  }, [L.W])
  if (problems.length) throw new Error(`${path.basename(file)}: ${problems.join(' | ')}`)
  await page.screenshot({ path: file, omitBackground: transparent })
  await page.close()
}

/** A white rounded rectangle on black, the footage's alpha mask. */
async function maskPng(browser, rect, file) {
  const page = await browser.newPage({ viewport: { width: rect.w, height: rect.h }, deviceScaleFactor: 1 })
  await page.setContent(`<html><body style="margin:0;background:#000"><div style="width:${rect.w}px;height:${rect.h}px;background:#fff;border-radius:${rect.isWin ? `0 0 ${rect.r}px ${rect.r}px` : `${rect.r}px`}"></div></body></html>`)
  await page.screenshot({ path: file })
  await page.close()
}

const ffmpeg = args => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 64 << 20 })
const even = n => 2 * Math.round(n / 2)

/** One segment of footage: the shot's clip framed, slowly zooming, between its layers; or the closing card. */
async function segmentVideo(L, seg, layers, out) {
  const d = seg.duration.toFixed(3)
  if (seg.shot === 'endcard') {
    const n = Math.max(1, Math.round(seg.duration * FPS))
    await ffmpeg(['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', layers.bg, '-vf',
      `scale=${L.W * 2}:${L.H * 2}:flags=lanczos,zoompan=z='1+0.03*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${L.W}x${L.H}:fps=${FPS},format=yuv420p`,
      '-t', d, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out])
    return
  }
  const r = layers.rect
  const W2 = even(r.w * 2), H2 = even(r.h * 2)
  // zoom anchored at the top right: the start of every Arabic line stays in the frame
  const zoom = `zoompan=z='1+${ZOOM}*on/${Math.max(1, Math.round(seg.duration * FPS))}':x='iw-iw/zoom':y='0':d=1:s=${r.w}x${r.h}:fps=${FPS}`
  let src, pre
  if (seg.foot.image) {
    // the screenshot's top part (its own bottom tab bar would be cut by the rounded screen), between the status bar
    // band and the home indicator band
    const top = even(H2 * PHONE_TOP), mid = even(H2 * (1 - PHONE_TOP - PHONE_BOTTOM))
    src = ['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', path.join(ROOT, seg.foot.image)]
    pre = `scale=${W2}:-2,crop=${W2}:${mid}:0:0,pad=${W2}:${H2}:0:${top}:white,setsar=1`
  } else {
    const rw = Math.min(1920, seg.foot.width), rh = Math.min(1080, Math.round(rw * r.h / r.w))
    const rx = Math.max(0, Math.min(1920 - rw, seg.foot.right - rw))
    const want = typeof seg.foot.top === 'object' ? seg.foot.top[L.W === L.H ? 'square' : 'story'] : seg.foot.top
    const ry = Math.max(0, Math.min(1080 - rh, want))
    src = ['-ss', seg.clipStart.toFixed(3), '-t', d, '-i', path.join(VO, 'final', `${seg.foot.slug}.mp4`)]
    pre = `fps=${FPS},crop=${rw}:${rh}:${rx}:${ry},scale=${W2}:${H2}:flags=lanczos,setsar=1`
  }
  const graph = [
    `[1:v]${pre},${zoom},format=rgba[v]`,
    `[2:v]format=gray,scale=${r.w}:${r.h}[m]`,
    `[v][m]alphamerge[vm]`,
    `[0:v][vm]overlay=${r.x}:${r.y}:shortest=1[b]`,
    `[b][3:v]overlay=0:0,format=yuv420p[out]`,
  ].join(';')
  await ffmpeg(['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', layers.bg, ...src, '-loop', '1', '-framerate', String(FPS), '-t', d, '-i', layers.mask,
    '-loop', '1', '-framerate', String(FPS), '-t', d, '-i', layers.fg, '-filter_complex', graph, '-map', '[out]', '-t', d, '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out])
}

// ---- the timeline: one segment per sentence (consecutive closing-card sentences share the card) -------------------
function timeline(script, timing, sceneStarts) {
  const sent = script.sentences.map((s, i) => ({ ...s, start: LEAD + timing[i].start, end: LEAD + timing[i].end }))
  const segs = []
  let ends = 0
  for (const s of sent) segs.push({ ...s, sentences: [s], endState: s.shot === 'endcard' ? ends++ : undefined })
  const total = sent[sent.length - 1].end + HOLD
  const used = {}
  segs.forEach((g, i) => {
    g.index = i
    g.at = i === 0 ? 0 : (segs[i - 1].sentences[segs[i - 1].sentences.length - 1].end + g.sentences[0].start) / 2
  })
  segs.forEach((g, i) => {
    const next = i + 1 < segs.length ? segs[i + 1].at : total
    g.span = next - g.at                                     // on screen alone
    g.duration = g.span + (i + 1 < segs.length ? FADE : 0)   // plus the cross-fade into the next
    if (g.shot !== 'endcard') {
      g.foot = FOOT[g.shot]
      if (!g.foot) throw new Error(`no footage for shot "${g.shot}"`)
      if (!g.foot.image) {
        const base = sceneStarts[g.foot.slug][g.foot.scene] + g.foot.offset
        g.clipStart = base + (used[g.shot] || 0)             // a shot used twice continues where it stopped
        used[g.shot] = (used[g.shot] || 0) + g.duration
      }
    }
    if (g.sentences.length > 1) g.text = g.sentences.map(s => s.text).join(' ')
  })
  return { segs, total }
}

// ---- main -----------------------------------------------------------------------------------------------------------
const script = JSON.parse(fs.readFileSync(path.join(DIR, 'script.json'), 'utf8'))
const report = JSON.parse(fs.readFileSync(path.join(VO, 'narration/ar/ad-promo/report.json'), 'utf8'))
if (report.scenes.length !== script.sentences.length) throw new Error('the timing report and the script differ in length')
const rec = JSON.parse(fs.readFileSync(path.join(VO, 'recorded/manifest.json'), 'utf8'))
const sceneStarts = Object.fromEntries(Object.entries(rec).map(([k, e]) => [k.split('/')[1], Object.fromEntries(e.scenes.map(s => [s.id, s.start]))]))
const { segs, total } = timeline(script, report.scenes, sceneStarts)
console.log(`ad: ${segs.length} segments, ${total.toFixed(1)} s: ${segs.map(g => `${g.shot} ${g.span.toFixed(1)}s`).join(', ')}`)

fs.mkdirSync(TMP, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const fmt of FORMATS) {
    const L = LAYOUT[fmt]
    if (!L) throw new Error(`unknown format ${fmt}`)
    const parts = []
    for (const g of segs) {
      const base = path.join(TMP, `${fmt}-${String(g.index).padStart(2, '0')}`)
      const layers = { bg: `${base}-bg.png`, fg: `${base}-fg.png`, mask: `${base}-mask.png` }
      if (g.shot === 'endcard') {
        await shoot(browser, L, endPage(L, g), layers.bg)
      } else {
        const p = shotPages(L, g)
        layers.rect = p.rect
        await shoot(browser, L, p.bg, layers.bg)
        await shoot(browser, L, p.fg, layers.fg, { transparent: true })
        await maskPng(browser, { ...p.rect, isWin: g.shot !== 'phone' }, layers.mask)
      }
      const out = `${base}.mp4`
      await segmentVideo(L, g, layers, out)
      parts.push({ file: out, duration: g.duration, at: g.at })
      console.log(`  ${fmt} ${g.index} ${g.shot}: ${g.duration.toFixed(2)} s`)
    }
    // cross-fades exactly at the sentence boundaries (each fade starts where the next segment's sentence begins)
    const inputs = parts.flatMap(p => ['-i', p.file])
    const chain = []
    let prev = '[0:v]'
    for (let i = 1; i < parts.length; i++) {
      const outLabel = i === parts.length - 1 ? '[vx]' : `[x${i}]`
      chain.push(`${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${parts[i].at.toFixed(3)}${outLabel}`)
      prev = outLabel
    }
    const audio = parts.length
    const graph = [...chain, `[${audio}:a]adelay=${Math.round(LEAD * 1000)}:all=1,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[ax]`].join(';')
    const target = path.join(DIR, `dentora-ad-${fmt}-ar.mp4`)
    await ffmpeg([...inputs, '-i', path.join(DIR, 'narration.wav'), '-filter_complex', graph, '-map', parts.length > 1 ? '[vx]' : '0:v', '-map', '[ax]',
      '-t', total.toFixed(3), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', target])
    await ffmpeg(['-ss', String(Math.min(2.5, total / 3)), '-i', target, '-frames:v', '1', '-q:v', '2', target.replace(/\.mp4$/, '.jpg')])
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration,size', '-of', 'json', target])
    const j = JSON.parse(stdout)
    console.log(`made ${path.relative(ROOT, target)}: ${Number(j.format.duration).toFixed(1)} s, ${(j.format.size / 1048576).toFixed(1)} MiB, ${j.streams.map(s => s.codec_type + (s.width ? ` ${s.width}×${s.height}` : '')).join(' + ')}`)
  }
} finally { await browser.close() }
