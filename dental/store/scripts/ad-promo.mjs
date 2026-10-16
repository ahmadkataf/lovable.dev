// The promo video ad, second cut: fast, in the Syrian (Damascene) dialect, showing the app's professional power, not
// only appointments. Stories (1080×1920: Instagram, Facebook, WhatsApp status, TikTok) and the square feed (1080×1080).
//   node store/scripts/ad-promo.mjs [--formats=story,square] [--stills=3.2,9.5] [--no-audio]
// Inputs (store/ads/video2/): script.json (the lines: text = the caption, spoken = what the voice read), narration.wav
// and words.json (store/scripts/ad-words.py: the take with its long pauses shortened, every spoken word in time).
// Footage: the course recordings (store/voiceover/final/<chapter>.mp4, scene starts in store/voiceover/recorded/
// manifest.json) and a phone screenshot. Every frame is drawn by Chromium from store/scripts/ad-promo-page.js as a
// function of time (titles, cuts, camera moves and highlights fall on the narration's words), piped into ffmpeg; the
// soundtrack (original synthesised music, the cuts' sound effects, the voice) comes from store/scripts/ad-music.py.
// Output: store/ads/video2/dentora-ad2-<format>-ar.mp4 (H.264 30 fps, AAC 48 kHz, -14 LUFS) and a cover .jpg.
// Every claim stays true of the app and the offer (server/src/pages/content.ts): one device per licence, 7-day trial.
// Stories cover about 250 px at the top and the bottom with the platform's own bar: the text stays between them.
import { chromium } from 'playwright'
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DIR = path.join(ROOT, 'store/ads/video2')
const VO = path.join(ROOT, 'store/voiceover')
const TMP = path.join(process.env.STORE_WORK || '/tmp/dentora-store-work', 'ad-promo')
const arg = (name, dflt) => (process.argv.find(a => a.startsWith(`--${name}=`)) || `=${dflt}`).split('=')[1]
const FORMATS = arg('formats', 'story,square').split(',')
const STILLS = arg('stills', '') ? arg('stills', '').split(',').map(Number) : null
const PY = process.env.ASR_PYTHON || 'python3'
const FPS = 30, LEAD = 0.35, PRE = 0.12, HOLD = 2.6

// ---- the narration, word by word ------------------------------------------------------------------------------------
const script = JSON.parse(fs.readFileSync(path.join(DIR, 'script.json'), 'utf8'))
const timing = JSON.parse(fs.readFileSync(path.join(DIR, 'words.json'), 'utf8'))
const byId = Object.fromEntries(timing.sentences.map(s => [s.id, s]))
const W = (id, k) => LEAD + byId[id].words[k].start
const E = (id, k) => LEAD + byId[id].words[k].end
const S = id => W(id, 0) - PRE
const TOTAL = LEAD + timing.duration + HOLD
/** The caption's words (as written) on the spoken words' times; when the counts differ, by position. */
function cap(id) {
  // words joined by a no-break space (U+00A0) in script.json stay on one caption line (nb: the space after the word)
  const parts = script.sentences.find(s => s.id === id).text.trim().split(/([ \u00A0]+)/)
  const shown = []
  for (let i = 0; i < parts.length; i += 2) shown.push({ text: parts[i], nb: (parts[i + 1] || '').includes('\u00A0') })
  const said = byId[id].words
  return shown.map(({ text, nb }, i) => {
    const k = shown.length === said.length ? i : Math.min(said.length - 1, Math.floor(i * said.length / shown.length))
    return { text, nb, a: LEAD + said[k].start, b: LEAD + said[k].end }
  })
}

// ---- the scenes: what is on screen, and when (source pixels of the 1920×1080 recordings; a camera region is
// [centre x, centre y, width], its height follows the window) --------------------------------------------------------
const clip = (key, slug, scene, offset, from, cam, rings = [], rate = 1) => ({ key, slug, scene, offset, from, rate, cam: cam.map(c => ({ at: from, ...c })), rings })
function scenes() {
  const list = []
  // the hook holds its question until the drop (the brand), with "you don't know?" under it
  list.push({ id: 'hook', kind: 'hook', start: 0, words: cap('hook'), ask: cap('reveal').slice(0, 2) })
  list.push({ id: 'reveal', kind: 'reveal', start: W('reveal', 2) - 0.04, words: cap('reveal'), drop: W('reveal', 2) - 0.04 })
  // the last highlight of a list fires a little before its word, so it holds before the cut
  const C = (k, dt = -0.12) => W('chart', k) + dt
  list.push({ id: 'chart', kind: 'feature', icon: 'tooth', kicker: 'مخطط الأسنان', title: 'كل سن… كل سطح', split: 2,
    clips: [
      clip('chart-a', 'chart', 'paint-surfaces', 0.3, S('chart'), [{ r: [760, 640, 1440] }, { at: W('chart', 0), r: [470, 850, 880] }]),
      clip('chart-b', 'chart', 'paint-surfaces', 4.6, C(3) - 0.06, [{ r: [775, 720, 1400] }], [
        { at: C(3), until: C(4), r: [905, 896, 164, 48] },
        { at: C(4), until: C(5), r: [229, 896, 206, 48] },
        { at: C(5), until: C(6), r: [449, 896, 93, 48] },
        { at: C(6), r: [1178, 963, 115, 48] }]),
    ],
    chips: [{ at: C(3), text: 'حشوة', dot: '#3B82F6' }, { at: C(4), text: 'عصب', dot: '#EC4899' },
      { at: C(5), text: 'تاج', dot: '#F59E0B' }, { at: C(6), text: 'زرعة', dot: '#8B5CF6' }],
    cap: cap('chart') })
  list.push({ id: 'plan', kind: 'feature', start: E('chart', 6) + 0.02, icon: 'clipboard', kicker: 'خطط العلاج', title: 'سن بسن… وعرض سعر', split: 2,
    clips: [
      clip('plan-a', 'treatments', 'plans', 2.8, S('plan'), [{ r: [760, 500, 1440] }, { at: W('plan', 2) - 0.05, r: [1120, 600, 820] }],
        [{ at: W('plan', 2) + 0.15, r: [1319, 497, 158, 314] }]),
      clip('plan-b', 'treatments', 'estimate', 2.4, W('plan', 4) - 0.08, [{ r: [960, 540, 1300] }, { at: W('plan', 6) - 0.05, r: [700, 640, 820] }],
        [{ at: W('plan', 6) + 0.15, r: [415, 638, 382, 116] }]),
    ],
    chips: [{ at: W('plan', 2), text: 'بنود سن بسن', icon: 'tooth' }, { at: W('plan', 6), text: 'تقدير تكلفة مطبوع', icon: 'printer' }],
    cap: cap('plan') })
  list.push({ id: 'allergy', kind: 'feature', icon: 'pill', kicker: 'الوصفات الطبية', title: 'تنبيه حساسية فوري', split: 1,
    clips: [
      clip('allergy-a', 'prescriptions', 'allergy-warn', 0.6, S('allergy'), [{ r: [1060, 500, 1300] }, { at: W('allergy', 2) - 0.05, r: [1250, 500, 820] }],
        [{ at: W('allergy', 4), r: [1580, 345, 48, 318], tone: 'red' }]),
      // the warning line itself, close enough to read on a phone
      clip('allergy-b', 'prescriptions', 'allergy-warn', 5.3, W('allergy', 6) - 0.08, [{ r: [1180, 560, 1000] }, { at: W('allergy', 6) + 0.05, r: [1330, 560, 720], dur: 0.45 }],
        [{ at: W('allergy', 7), r: [1050, 556, 590, 62], tone: 'red' }]),
    ],
    chips: [{ at: W('allergy', 4), text: 'تحذير جنب الدوا', icon: 'alert', tone: 'red' }, { at: W('allergy', 6) + 0.1, text: 'قبل ما تحفظ الوصفة', icon: 'shield' }],
    cap: cap('allergy') })
  list.push({ id: 'billing', kind: 'feature', icon: 'receipt', kicker: 'الفواتير والدفعات', title: 'فاتورة بكبسة', split: 1,
    clips: [
      clip('billing-a', 'billing', 'from-treatments', 0.4, S('billing'), [{ r: [985, 640, 1450] }, { at: W('billing', 1), r: [1290, 580, 820] }],
        [{ at: W('billing', 2), r: [1362, 466, 284, 250] }]),
      // "إضافة المحدد": the finished treatments become invoice lines right on "بكبسة"
      clip('billing-b', 'billing', 'from-treatments', 3.75, W('billing', 4) - 0.08, [{ r: [960, 600, 1500] }],
        [{ at: W('billing', 5) + 0.12, r: [244, 430, 1432, 316] }]),
    ],
    chips: [{ at: W('billing', 2), text: 'من العلاج المنجز', icon: 'check' }, { at: W('billing', 4), text: 'دفعات وكشف حساب', icon: 'wallet' }],
    cap: cap('billing') })
  list.push({ id: 'reports', kind: 'feature', icon: 'barChart', kicker: 'التقارير المالية', title: 'صافي ربحك… بالضبط', split: 2,
    clips: [clip('reports', 'reports', 'kpis', 8.0, S('reports'), [
      { r: [760, 560, 1440] },
      { at: W('reports', 2) - 0.06, r: [1315, 592, 620] },
      { at: W('reports', 3) - 0.06, r: [946, 592, 620] },
      { at: W('reports', 4) - 0.06, r: [578, 592, 620] },
      { at: W('reports', 6) - 0.06, r: [900, 600, 1240], dur: 0.7 }], [
      { at: W('reports', 2), until: W('reports', 3), r: [1145, 470, 340, 245] },
      { at: W('reports', 3), until: W('reports', 4), r: [775, 470, 342, 245], tone: 'amber' },
      { at: W('reports', 4), r: [405, 470, 345, 245], tone: 'green' }])],
    chips: [{ at: W('reports', 6), text: 'وأداء كل طبيب', icon: 'users' }],
    cap: cap('reports') })
  // each item settles on its detail fast (the items last under a second)
  const it = (k, label, sub, icon, key, slug, scene, offset, r0, r1, tone) => ({ at: W('montage', k) - 0.04, label, sub, icon, tone,
    clip: clip(key, slug, scene, offset, W('montage', k) - 0.04, [{ r: r0 }, { at: W('montage', k) - 0.04, r: r1, dur: 0.3 }]) })
  list.push({ id: 'montage', kind: 'montage', icon: 'layout', kicker: 'وكمان', intro: 'وفوق هيك…',
    introClip: clip('dash-a', 'dashboard', 'overview', 1.0, S('montage'), [{ r: [760, 540, 1440] }]),
    items: [
      it(2, 'المخبر', 'مواعيد التسليم بالألوان', 'flask', 'lab', 'lab', 'due-colours', 1.6, [760, 620, 1300], [560, 830, 780]),
      it(3, 'المخزون', 'تنبيه قبل انتهاء الصلاحية', 'package', 'inv', 'inventory', 'expiring', 1.15, [760, 600, 1300], [470, 800, 780]),
      it(4, 'صلاحيات الموظفين', 'مدير · طبيب · مساعد · استقبال', 'key', 'staff', 'staff', 'matrix', 1.7, [1000, 560, 1300], [1030, 425, 940]),
      it(6, 'تذكير عالواتساب', 'رسالة جاهزة باسم المريض وموعده', 'whatsapp', 'wa', 'appointments', 'reminder', 2.4, [960, 560, 1300], [945, 820, 920]),
      it(8, 'نسخ احتياطي مشفّر', 'محمي بكلمة مرور', 'lock', 'backup', 'backup', 'protect', 4.2, [760, 600, 1300], [620, 800, 980]),
    ],
    cap: cap('montage') })
  list.push({ id: 'offline', kind: 'offline', icon: 'wifiOff', kicker: 'ويندوز أو أندرويد', title: 'بلا إنترنت', split: 1,
    clip: clip('dash-b', 'dashboard', 'overview', 10.5, S('offline'), [{ r: [760, 430, 1460] }]),
    at: { net: W('offline', 2), win: W('offline', 4), android: W('offline', 6), data: W('offline', 7) },
    cap: cap('offline') })
  list.push({ id: 'offer', kind: 'offer', start: S('offer'), at: { trial: W('offer', 0), price: W('offer', 5) - 0.03, device: W('offer', 9), life: W('offer', 12) } })
  list.push({ id: 'cta', kind: 'cta', start: S('cta'), at: { no: W('cta', 0), strike: W('cta', 2), head: W('cta', 3), go: W('cta', 6) - 0.04 } })
  for (const s of list) if (s.start === undefined) s.start = S(s.id)
  list.forEach((s, i) => { s.end = i + 1 < list.length ? list[i + 1].start : TOTAL })
  return list
}
const SCENES = scenes()

// ---- the footage: every clip's frames, extracted once ---------------------------------------------------------------
const rec = JSON.parse(fs.readFileSync(path.join(VO, 'recorded/manifest.json'), 'utf8'))
const sceneStart = (slug, id) => {
  const s = rec[`ar/${slug}`]?.scenes.find(x => x.id === id)
  if (!s) throw new Error(`no scene ${slug}/${id} in the recordings`)
  return s.start
}
function allClips() {
  const out = []
  for (const s of SCENES) {
    const own = [...(s.clips || []), ...(s.items || []).map(x => x.clip), s.introClip, s.clip].filter(Boolean)
    own.forEach(c => out.push({ c, scene: s }))
  }
  // each clip lasts until the next one of its scene starts, or the scene ends
  for (const s of SCENES) {
    const seq = [s.introClip, ...(s.clips || []), ...(s.items || []).map(x => x.clip), s.clip].filter(Boolean).sort((a, b) => a.from - b.from)
    seq.forEach((c, i) => { c.until = i + 1 < seq.length ? seq[i + 1].from : s.end })
  }
  return out.map(x => x.c)
}
const ffmpeg = args => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 64 << 20 })
async function extract(c) {
  const dir = path.join(TMP, 'frames', c.key)
  const dur = (c.until - c.from) * c.rate + 0.3
  const stamp = `${c.slug}/${c.scene}/${c.offset}/${dur.toFixed(2)}/${c.rate}/v2`
  if (fs.existsSync(path.join(dir, 'stamp')) && fs.readFileSync(path.join(dir, 'stamp'), 'utf8') === stamp) return { dir, n: fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length }
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const start = sceneStart(c.slug, c.scene) + c.offset
  // at rate r the clip shows r seconds of the recording per second: frames sampled at FPS / r play back at FPS
  await ffmpeg(['-ss', start.toFixed(3), '-t', dur.toFixed(3), '-i', path.join(VO, 'final', `${c.slug}.mp4`), '-vf', `fps=${(FPS / c.rate).toFixed(4)}`, '-q:v', '2', path.join(dir, '%05d.jpg')])
  fs.writeFileSync(path.join(dir, 'stamp'), stamp)
  return { dir, n: fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length }
}
const WALL = [['dashboard', 'overview', 6], ['reports', 'kpis', 6], ['chart', 'paint-surfaces', 6], ['lab', 'cards', 3], ['treatments', 'plans', 3.3],
  ['inventory', 'cards', 3], ['billing', 'payment', 1], ['appointments', 'views', 3], ['patients', 'files-tab', 3], ['prescriptions', 'sheet', 3]]
async function wallStills() {
  const dir = path.join(TMP, 'wall'); fs.mkdirSync(dir, { recursive: true })
  const out = []
  for (const [slug, scene, off] of WALL) {
    const f = path.join(dir, `${slug}-${scene}.jpg`)
    if (!fs.existsSync(f)) await ffmpeg(['-ss', (sceneStart(slug, scene) + off).toFixed(2), '-i', path.join(VO, 'final', `${slug}.mp4`), '-frames:v', '1', '-vf', 'scale=640:360:flags=lanczos', '-q:v', '3', f])
    out.push(pathToFileURL(f).href)
  }
  return out
}

// ---- brand, icons, layout -------------------------------------------------------------------------------------------
const font = f => pathToFileURL(path.join(ROOT, 'node_modules', f)).href
const ICON_SVG = fs.readFileSync(path.join(ROOT, 'public/icon.svg'), 'utf8')
const TOOTH_PATH = ICON_SVG.match(/<path d="([^"]+)"/)[1]
const SPARK = ICON_SVG.match(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/).slice(1).map(Number)
const appIcon = (size, id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#0E8F86"/></linearGradient></defs>
  <rect width="256" height="256" rx="60" fill="url(#${id})"/><g transform="translate(3 8)"><path d="${TOOTH_PATH}" fill="#fff" opacity=".97"/>
  <circle cx="${SPARK[0]}" cy="${SPARK[1]}" r="${SPARK[2]}" fill="#fff" opacity=".9"/></g></svg>`
const ICONS = {   // lucide, the app's icon set
  tooth: '<path d="M11.88 4.62C10.38 2.88 8.38 2.44 6.38 3.88C4.12 5.5 3.62 8.62 4.62 11.38C5.75 14.5 6.38 18.38 7.38 20.62C7.75 21.5 8.88 21.5 9.25 20.62C9.88 19.12 10.25 16.88 10.88 15.38C11.25 14.38 12.5 14.38 12.88 15.38C13.5 16.88 13.88 19.12 14.5 20.62C14.88 21.5 16 21.5 16.38 20.62C17.38 18.38 18 14.5 19.12 11.38C20.12 8.62 19.62 5.5 17.38 3.88C15.38 2.44 13.38 2.88 11.88 4.62Z"/>',
  receipt: '<path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  infinity: '<path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  whatsapp: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path transform="translate(7.1 7.1) scale(.41)" stroke-width="4.6" d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  barChart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  layout: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  flask: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
}

const LAYOUT = {
  story: { W: 1080, H: 1920, brand: { top: 268, icon: 56, size: 36 }, kicker: { top: 352, size: 30 }, title: { top: 404, h: 132, size: 88 },
    win: { left: 40, top: 578, width: 1000, bar: 36, height: 740 }, chips: { top: 1296, size: 30 }, cap: { top: 1396, h: 196, size: 48 },
    steps: { top: 1372 }, strip: { top: 1604, size: 24 }, wall: { cols: 5, rows: 7, scale: 1.25 },
    hook: { top: 560, h: 820, s1: 92, s2: 84, s3: 176, s4: 92 },
    reveal: { askTop: 650, askUp: 330, askSize: 110, icon: 230, iconTop: 520, markTop: 772, tagTop: 1040, t1: 78, t2: 112 },
    offline: { win: { left: 40, top: 578, width: 1000, height: 610 }, phone: { left: 650, top: 760, width: 350, height: 622 },
      badge: { left: 64, top: 604 }, winTag: { left: 64, top: 1240 }, phoneTag: { left: 700, top: 1300 }, dataTag: { left: 64, top: 1316 } },
    offer: { trial: 520, trialHero: 700, price: 750, priceSize: 380, once: 1210, life: 1330 },
    cta: { nosub: 560, nohead: 702, go: 900, goH: 150, num: 1098, site: 1252, recap: 1392, nosubHero: 820, noheadHero: 962 } },
  square: { W: 1080, H: 1080, brand: { top: 20, icon: 42, size: 30 }, kicker: { top: 76, size: 22 }, title: { top: 112, h: 74, size: 56 },
    win: { left: 90, top: 200, width: 900, bar: 28, height: 520 }, chips: { top: 700, size: 22 }, cap: { top: 790, h: 140, size: 34 },
    steps: { top: 760 }, strip: { top: 958, size: 22 }, wall: { cols: 5, rows: 5, scale: 0.95 },
    hook: { top: 190, h: 700, s1: 64, s2: 66, s3: 116, s4: 64 },
    reveal: { askTop: 340, askUp: 64, askSize: 80, icon: 170, iconTop: 196, markTop: 386, tagTop: 600, t1: 56, t2: 82 },
    offline: { win: { left: 40, top: 200, width: 760, height: 470 }, phone: { left: 728, top: 222, width: 290, height: 516 },
      badge: { left: 62, top: 222 }, winTag: { left: 62, top: 712 }, phoneTag: { left: 760, top: 712 }, dataTag: { left: 300, top: 712 } },
    offer: { trial: 200, trialHero: 300, price: 330, priceSize: 270, once: 700, life: 800 },
    cta: { nosub: 250, nohead: 350, go: 470, goH: 118, num: 620, site: 740, recap: 840, nosubHero: 420, noheadHero: 520 } },
}

function css(L) {
  const sq = L.W === L.H, k = sq ? 0.72 : 1
  return `
@font-face { font-family: Inter; src: url(${font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
@font-face { font-family: Kufi; src: url(${font('@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-arabic-wght-normal.woff2')}) format('woff2'); font-weight: 100 900 }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: ${L.W}px; height: ${L.H}px; overflow: hidden; background: #051C1B }
body { font-family: Kufi, Inter, sans-serif; color: #fff; -webkit-font-smoothing: antialiased }
#stage { position: absolute; inset: 0; overflow: hidden }
#stage > * { position: absolute }
.i { width: 1em; height: 1em; flex: none }
.bg { inset: 0; overflow: hidden; background: radial-gradient(130% 62% at 50% 0%, #0E4A46 0%, #08302D 46%, #051C1B 100%) }
.bg .glow { position: absolute; border-radius: 50%; filter: blur(110px) }
.bg .dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.085) 1.6px, transparent 1.8px); background-size: 34px 34px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 38%, transparent 62%) }
.wall { inset: 0; overflow: hidden; perspective: 1700px; background: #041615 }
.wall .plane { position: absolute; left: 50%; top: 50%; display: grid; gap: 28px; transform-style: preserve-3d }
.wall img { width: 640px; height: 360px; border-radius: 18px; box-shadow: 0 30px 70px rgba(0,0,0,.55) }
.wall .shade { position: absolute; inset: 0; background: radial-gradient(80% 60% at 50% 50%, rgba(4,26,24,.82) 0%, rgba(3,18,17,.97) 100%) }
.brand { top: ${L.brand.top}px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: ${Math.round(L.brand.size * 0.36)}px; direction: ltr }
.brand svg { width: ${L.brand.icon}px; height: ${L.brand.icon}px; filter: drop-shadow(0 10px 22px rgba(0,0,0,.35)) }
.brand b { font: 800 ${L.brand.size}px/1 Inter, sans-serif; letter-spacing: -.025em }
.kicker { top: ${L.kicker.top}px; left: 0; right: 0; display: flex; justify-content: center }
.kicker span { display: flex; align-items: center; gap: ${Math.round(L.kicker.size * 0.4)}px; padding: ${Math.round(L.kicker.size * 0.28)}px ${Math.round(L.kicker.size * 0.8)}px;
  border-radius: 999px; font-size: ${L.kicker.size}px; font-weight: 700; line-height: 1.25; color: #CFFAF1; background: rgba(20,184,166,.18); box-shadow: inset 0 0 0 1.5px rgba(94,234,212,.45) }
.kicker .i { color: #5EEAD4; font-size: 1.1em }
.title { top: ${L.title.top}px; left: 30px; right: 30px; height: ${L.title.h}px; display: flex; align-items: center; justify-content: center; text-align: center }
.title h1 { font-size: ${L.title.size}px; font-weight: 800; line-height: 1.25; white-space: nowrap; text-shadow: 0 6px 30px rgba(0,0,0,.3) }
.w { display: inline-block }
.g, .title em { font-style: normal; background: linear-gradient(90deg, #A7F3E4 0%, #5EEAD4 45%, #2DD4BF 100%); -webkit-background-clip: text; background-clip: text; color: transparent }
.title .g { display: inline-block; padding-bottom: .42em; margin-bottom: -.34em }
.win { border-radius: 18px; background: #fff; overflow: hidden; transform-origin: 50% 50%;
  box-shadow: 0 0 0 1.5px rgba(255,255,255,.2), 0 60px 110px -30px rgba(0,0,0,.7), 0 24px 50px -20px rgba(0,0,0,.5) }
.win .bar { height: ${L.win.bar}px; display: flex; align-items: center; padding: 0 16px; background: #F8FAFC; border-bottom: 1px solid #E6EAF0; direction: ltr }
.win .bar .ctl { margin-left: auto; display: flex; gap: 20px; padding-right: 6px }
.win .bar .ctl i { display: block; width: 11px; height: 11px; border: 1.7px solid #64748B; border-width: 0 0 1.7px }
.win .bar .ctl i.max { border-width: 1.7px; border-radius: 2px }
.win .bar .ctl i.x { border: 0; width: 13px; height: 13px; display: grid; color: #64748B } .win .bar .ctl i.x .i { width: 100%; height: 100%; stroke-width: 2.6 }
.win .screen { position: relative; overflow: hidden; background: #fff }
.foot { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; image-rendering: auto }
.ring { position: absolute; border-radius: 14px; border: ${sq ? 3 : 4}px solid #14B8A6; transform-origin: 50% 50%;
  box-shadow: 0 0 0 calc(4px + 8px * var(--p)) rgba(20,184,166,.22), 0 0 30px rgba(20,184,166,.35) }
.ring.red { border-color: #EF4444; box-shadow: 0 0 0 calc(4px + 8px * var(--p)) rgba(239,68,68,.22), 0 0 30px rgba(239,68,68,.4) }
.ring.green { border-color: #16A34A; box-shadow: 0 0 0 calc(4px + 8px * var(--p)) rgba(22,163,74,.24), 0 0 30px rgba(22,163,74,.4) }
.ring.amber { border-color: #F59E0B; box-shadow: 0 0 0 calc(4px + 8px * var(--p)) rgba(245,158,11,.24), 0 0 30px rgba(245,158,11,.4) }
.chips { top: ${L.chips.top}px; left: 24px; right: 24px; display: flex; justify-content: center; flex-wrap: wrap; gap: ${Math.round(L.chips.size * 0.45)}px }
.chip { display: flex; align-items: center; gap: ${Math.round(L.chips.size * 0.4)}px; padding: ${Math.round(L.chips.size * 0.42)}px ${Math.round(L.chips.size * 0.75)}px; border-radius: 999px;
  background: #fff; color: #0F172A; font-size: ${L.chips.size}px; font-weight: 700; line-height: 1.2; white-space: nowrap; box-shadow: 0 20px 40px -14px rgba(0,0,0,.6) }
.chip .i { color: #0F716C; font-size: 1.15em } .chip.red { background: #FEF2F2; color: #991B1B } .chip.red .i { color: #DC2626 }
.chip .dot { width: .7em; height: .7em; border-radius: 4px; flex: none }
.cap { top: ${L.cap.top}px; left: 40px; right: 40px; height: ${L.cap.h}px; display: flex; align-items: center; justify-content: center; text-align: center }
.cap p { font-size: ${L.cap.size}px; font-weight: 800; line-height: 1.5; text-wrap: balance; text-shadow: 0 3px 14px rgba(0,0,0,.5) }
.cap span { transition: none } .cap .next { color: rgba(255,255,255,.38) } .cap .done { color: #fff } .cap .cur { color: #5EEAD4 }
.steps { top: ${L.steps.top}px; left: 0; right: 0; display: flex; justify-content: center; gap: 12px }
.steps i { width: ${sq ? 30 : 40}px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.22) }
.steps i.done { background: rgba(94,234,212,.55) } .steps i.on { background: #5EEAD4; width: ${sq ? 56 : 76}px }
.strip { ${L.strip ? `top: ${L.strip.top}px;` : 'display: none;'} left: 0; right: 0; display: flex; justify-content: center }
.flash { inset: 0; background: #fff; pointer-events: none }
.strip span { display: flex; align-items: center; gap: 12px; padding: 8px 22px; border-radius: 999px; font-size: ${L.strip ? L.strip.size : 20}px; font-weight: 700;
  background: rgba(255,255,255,.10); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18); color: #E6FFFA }
.strip b { font-family: Inter, sans-serif; direction: ltr; color: #7EE3D2 } .strip em { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.4) }
/* the hook */
.hook { top: ${L.hook.top}px; left: 40px; right: 40px; height: ${L.hook.h}px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: ${Math.round(16 * k)}px }
.hook p { display: block }
.hook .l1 { font-size: ${L.hook.s1}px; font-weight: 700; color: #7EE3D2 }
.hook .l2 { font-size: ${L.hook.s2}px; font-weight: 800; line-height: 1.3; white-space: nowrap }
.hook .l2 span { display: inline-block }
.hook .l3 { font-size: ${L.hook.s3}px; font-weight: 900; line-height: 1.25 }
.hook .l4 { font-size: ${L.hook.s4}px; font-weight: 800; line-height: 1.3; white-space: nowrap } .hook .l4 span { display: inline-block }
.hook .l3 em { display: inline-block; font-style: normal; background: linear-gradient(90deg, #A7F3E4 0%, #5EEAD4 45%, #2DD4BF 100%); -webkit-background-clip: text; background-clip: text; color: transparent; padding: 0 .1em .42em; margin-bottom: -.32em }
/* the reveal */
.ask { left: 50%; translate: -50% 0; width: max-content; text-align: center; font-weight: 800; line-height: 1.3; white-space: nowrap }
.ask span { display: inline-block }
.burst { left: 50%; border-radius: 50%; translate: -50% -50%; border: 6px solid rgba(94,234,212,.9); box-shadow: 0 0 60px rgba(94,234,212,.6) }
.logo-big { left: calc(50% - ${L.reveal.icon / 2}px); width: ${L.reveal.icon}px; height: ${L.reveal.icon}px; filter: drop-shadow(0 30px 60px rgba(0,0,0,.5)) }
.logo-big svg { width: 100%; height: 100% }
.mark { left: 0; right: 0; text-align: center; direction: ltr }
.mark b { display: block; font: 900 ${Math.round(124 * k)}px/1.05 Inter, sans-serif; letter-spacing: -.035em }
.mark small { display: block; margin-top: ${Math.round(10 * k)}px; font: 700 ${Math.round(36 * k)}px/1.3 Kufi, sans-serif; color: #7EE3D2; direction: rtl }
.tag { left: 30px; right: 30px; display: flex; flex-direction: column; align-items: center; text-align: center }
.tag p { white-space: nowrap; font-weight: 800; line-height: 1.3 }
.tag span { display: inline-block }
.tag .t1 { font-size: ${L.reveal.t1}px } .tag .t2 { font-size: ${L.reveal.t2}px }
.tag .t2 span { background: linear-gradient(90deg, #A7F3E4 0%, #5EEAD4 45%, #2DD4BF 100%); -webkit-background-clip: text; background-clip: text; color: transparent; padding-bottom: .42em; margin-bottom: -.32em }
/* offline */
.phone { background: #0B1220; padding: ${sq ? 8 : 10}px; border-radius: ${sq ? 38 : 46}px; transform-origin: 50% 100%;
  box-shadow: 0 0 0 2px #273449 inset, 0 0 0 2.5px rgba(255,255,255,.22), 0 70px 120px -30px rgba(0,0,0,.8), 0 30px 60px -24px rgba(0,0,0,.6) }
.phone .screen { position: relative; width: 100%; height: 100%; border-radius: ${sq ? 30 : 37}px; overflow: hidden; background: #fff }
.phone .screen img { position: absolute; left: 0; top: ${sq ? 20 : 26}px; width: 100%; height: auto }
.pstatus { position: absolute; left: 0; right: 0; top: 0; height: ${sq ? 22 : 28}px; padding: 0 ${sq ? 16 : 20}px; display: flex; align-items: center; justify-content: space-between;
  direction: ltr; background: #fff; color: #0F172A; font: 600 ${sq ? 11 : 14}px/1 Inter, sans-serif }
.pstatus .icons { display: flex; gap: 6px } .pstatus .i { width: ${sq ? 12 : 15}px; height: ${sq ? 12 : 15}px; stroke-width: 2.4 }
.netoff { width: ${sq ? 92 : 128}px; height: ${sq ? 92 : 128}px; border-radius: 50%; display: grid; place-items: center; font-size: ${sq ? 46 : 64}px;
  background: linear-gradient(180deg, #F87171, #DC2626); color: #fff; box-shadow: 0 0 0 ${sq ? 8 : 12}px rgba(239,68,68,.22), 0 24px 50px -12px rgba(0,0,0,.6) }
.netoff .i { stroke-width: 2.4 }
.tag2 { display: flex; align-items: center; gap: 12px; padding: ${sq ? '10px 18px' : '14px 24px'}; border-radius: 999px; background: #fff; color: #0F172A;
  font-size: ${sq ? 22 : 30}px; font-weight: 800; line-height: 1.2; white-space: nowrap; box-shadow: 0 20px 40px -14px rgba(0,0,0,.6) }
.tag2 .i { color: #0F716C; font-size: 1.2em }
/* the offer */
.trial { left: 0; right: 0; display: flex; justify-content: center }
.trial span { display: flex; align-items: center; gap: ${Math.round(18 * k)}px; padding: ${Math.round(20 * k)}px ${Math.round(40 * k)}px; border-radius: 999px; font-size: ${Math.round(56 * k)}px; font-weight: 800;
  background: rgba(20,184,166,.18); box-shadow: inset 0 0 0 2.5px rgba(94,234,212,.6), 0 30px 60px -30px rgba(0,0,0,.5) }
.trial b { font-family: Inter, sans-serif; font-weight: 900; color: #5EEAD4 }
.trial small { font-size: .8em; font-weight: 700; color: #A7F3E4; padding-inline-start: .4em; border-inline-start: 2px solid rgba(255,255,255,.25) }
.trial .i { color: #5EEAD4 }
.thero { left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: ${Math.round(14 * k)}px; text-align: center }
.thero .gift { display: grid; place-items: center; width: ${Math.round(124 * k)}px; height: ${Math.round(124 * k)}px; border-radius: 50%; font-size: ${Math.round(62 * k)}px; color: #5EEAD4;
  background: rgba(20,184,166,.2); box-shadow: inset 0 0 0 2.5px rgba(94,234,212,.6), 0 30px 60px -24px rgba(0,0,0,.5) }
.thero b { font-size: ${Math.round(96 * k)}px; font-weight: 900; line-height: 1.25; white-space: nowrap }
.thero b em { font-style: normal; font-family: Inter, sans-serif; color: #5EEAD4 }
.thero small { font-size: ${Math.round(50 * k)}px; font-weight: 800; color: #A7F3E4 }
.pring { left: 50%; border-radius: 50%; translate: -50% -50%; border: 5px solid rgba(94,234,212,.9) }
.price { left: 0; right: 0; text-align: center; direction: ltr; line-height: 1 }
.price b { font-family: Inter, sans-serif; font-weight: 900; letter-spacing: -.05em; background: linear-gradient(180deg, #FFFFFF 30%, #7EE3D2 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 20px 50px rgba(20,184,166,.45)) }
.price sup { font-size: .42em; vertical-align: .95em; margin-left: .04em }
.once { left: 50%; translate: -50% 0; width: max-content; display: flex; justify-content: center; align-items: center; gap: ${Math.round(22 * k)}px; font-size: ${Math.round(58 * k)}px; font-weight: 800 }
.once em { width: ${Math.round(12 * k)}px; height: ${Math.round(12 * k)}px; border-radius: 50%; background: #5EEAD4 }
.life { left: 50%; translate: -50% 0; width: max-content; display: flex; justify-content: center; align-items: center; gap: ${Math.round(20 * k)}px; font-size: ${Math.round(88 * k)}px; font-weight: 900 }
.life span { background: linear-gradient(90deg, #A7F3E4 0%, #5EEAD4 45%, #2DD4BF 100%); -webkit-background-clip: text; background-clip: text; color: transparent; padding-bottom: .42em; margin-bottom: -.32em }
.life .i { color: #5EEAD4; stroke-width: 2.4 }
/* the call to action */
.nosub { left: 50%; translate: -50% 0; width: max-content; display: flex; justify-content: center; align-items: center; gap: ${Math.round(24 * k)}px; font-size: ${Math.round(92 * k)}px; font-weight: 900 }
.nosub .x { width: 1em; height: 1em; border-radius: 50%; display: grid; place-items: center; background: #DC2626; font-size: .8em; box-shadow: 0 0 0 10px rgba(220,38,38,.2) }
.nosub .x .i { width: .62em; height: .62em; stroke-width: 3.4 }
.nosub .txt { position: relative; color: rgba(255,255,255,.92) }
.nosub .txt i { position: absolute; left: -4%; right: -4%; top: 54%; height: ${Math.round(12 * k)}px; border-radius: 6px; background: #EF4444; transform-origin: 100% 50%; box-shadow: 0 4px 14px rgba(0,0,0,.4) }
.nohead { left: 0; right: 0; text-align: center; font-size: ${Math.round(64 * k)}px; font-weight: 800; color: #A7F3E4 }
.go { left: ${sq ? 90 : 56}px; right: ${sq ? 90 : 56}px; display: flex; align-items: center; justify-content: center; gap: ${Math.round(22 * k)}px; border-radius: 999px;
  font-size: ${Math.round(58 * k)}px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #2EE07A, #1EBE5D); text-shadow: 0 2px 8px rgba(0,80,30,.3);
  box-shadow: 0 30px 60px -20px rgba(30,190,93,.75), inset 0 3px 0 rgba(255,255,255,.35) }
.go .i { font-size: 1.25em; stroke-width: 2.2 }
.ripple { left: ${sq ? 90 : 56}px; right: ${sq ? 90 : 56}px; border-radius: 999px; border: 4px solid rgba(46,224,122,.8) }
.num { left: 0; right: 0; display: flex; justify-content: center }
.num span { direction: ltr; font: 800 ${Math.round(70 * k)}px/1 Inter, sans-serif; letter-spacing: .01em; padding: ${Math.round(18 * k)}px ${Math.round(40 * k)}px; border-radius: 999px; background: #0B2E1C; box-shadow: inset 0 0 0 2px rgba(46,224,122,.5) }
.site { left: 0; right: 0; display: flex; justify-content: center }
.site span { display: flex; align-items: center; gap: ${Math.round(14 * k)}px; font-size: ${Math.round(40 * k)}px; font-weight: 700; padding: ${Math.round(14 * k)}px ${Math.round(32 * k)}px; border-radius: 999px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.2) }
.site b { font-family: Inter, sans-serif; direction: ltr; color: #7EE3D2 }
.site .i { color: #5EEAD4 }
.recap { left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: ${Math.round(18 * k)}px; font-size: ${Math.round(34 * k)}px; font-weight: 700; color: #E6FFFA }
.recap span { display: flex; align-items: center; gap: 10px } .recap .i { color: #5EEAD4 } .recap b { font-family: Inter, sans-serif }
.recap em { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.4) }
`
}

// ---- rendering --------------------------------------------------------------------------------------------------------
async function renderFormat(browser, fmt, data) {
  const L = LAYOUT[fmt]
  const page = await browser.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: 1 })
  const html = path.join(TMP, `${fmt}.html`)
  const D = { ...data, L, fps: FPS }
  fs.writeFileSync(html, `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css(L)}</style></head><body><div id="stage"></div>
<script>const D = ${JSON.stringify(D)}</script><script src="${pathToFileURL(path.join(ROOT, 'store/scripts/ad-promo-page.js')).href}"></script></body></html>`)
  page.on('pageerror', e => console.error('page error:', e.message))
  await page.goto(pathToFileURL(html).href)
  await page.evaluate(async () => { await document.fonts.load('800 40px Kufi'); await document.fonts.load('900 40px Inter'); await document.fonts.ready })
  const shot = async t => {
    const missing = await page.evaluate(t => window.frame(t), t)
    if (missing.length) throw new Error(`${fmt} t=${t.toFixed(2)}: missing ${missing.join(', ')}`)
    return page.screenshot({ type: 'jpeg', quality: 93 })
  }
  if (STILLS) {
    for (const t of STILLS) {
      const f = path.join(TMP, `still-${fmt}-${t.toFixed(2)}.jpg`)
      fs.writeFileSync(f, await shot(t))
      console.log(f)
    }
    await page.close()
    return
  }
  const target = path.join(DIR, `dentora-ad2-${fmt}-ar.mp4`)
  const audio = path.join(TMP, 'mix.wav')
  const enc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', audio, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000', '-t', TOTAL.toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', target], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => enc.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))))
  const n = Math.round(TOTAL * FPS)
  const t0 = Date.now()
  for (let i = 0; i < n; i++) {
    const buf = await shot(i / FPS)
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r))
    if (i % 150 === 0) console.log(`  ${fmt}: frame ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  }
  enc.stdin.end()
  await done
  await page.close()
  await ffmpeg(['-ss', '7.6', '-i', target, '-frames:v', '1', '-q:v', '2', target.replace(/\.mp4$/, '.jpg')])
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration,size', '-of', 'json', target])
  const j = JSON.parse(stdout)
  console.log(`made ${path.relative(ROOT, target)}: ${Number(j.format.duration).toFixed(1)} s, ${(j.format.size / 1048576).toFixed(1)} MiB, ${j.streams.map(s => s.codec_type + (s.width ? ` ${s.width}×${s.height}` : '')).join(' + ')}`)
}

/** The soundtrack: music and effects on the cuts (ad-music.py), the voice LEAD seconds in. */
async function soundtrack() {
  const cuts = []
  for (const s of SCENES.slice(2)) {
    cuts.push(s.start)
    for (const c of s.clips || []) if (c.from > s.start + 0.05) cuts.push(c.from)
    for (const x of s.items || []) cuts.push(x.at)
  }
  const offer = SCENES.find(s => s.id === 'offer'), call = SCENES.find(s => s.id === 'cta'), rev = SCENES.find(s => s.id === 'reveal')
  const cues = { duration: TOTAL, lead: LEAD, drop: rev.drop, whoosh: cuts.filter(t => Math.abs(t - offer.at.price) > 0.3),
    impact: [rev.drop, offer.at.price, call.at.go], riser: [rev.drop], break: [offer.at.trial - 0.1, offer.at.price], end: TOTAL - 1.4 }
  const f = path.join(TMP, 'cues.json')
  fs.writeFileSync(f, JSON.stringify(cues))
  const { stdout } = await run(PY, [path.join(ROOT, 'store/scripts/ad-music.py'), f, path.join(DIR, 'narration.wav'), path.join(TMP, 'mix.wav')], { maxBuffer: 16 << 20 })
  process.stdout.write(stdout)
}

// ---- main -----------------------------------------------------------------------------------------------------------
fs.mkdirSync(TMP, { recursive: true })
console.log(`ad: ${TOTAL.toFixed(1)} s: ${SCENES.map(s => `${s.id} ${s.start.toFixed(1)}`).join(', ')}`)
const clips = allClips()
const frames = {}
for (const c of clips) frames[c.key] = await extract(c).then(x => ({ dir: pathToFileURL(x.dir).href, n: x.n }))
const data = {
  scenes: SCENES, frames, icons: ICONS, wall: await wallStills(),
  phone: pathToFileURL(path.join(ROOT, 'store/screenshots/phone/ar/03-chart.png')).href,
  appIcon: appIcon(64, 'ia'), appIconBig: appIcon(256, 'ib'),
}
if (!STILLS && !process.argv.includes('--no-audio')) await soundtrack()
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const fmt of FORMATS) await renderFormat(browser, fmt, data)
} finally { await browser.close() }
