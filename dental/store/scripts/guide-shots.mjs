// The user guide's pictures: turns every GuideShot of the guide's topics (server/guide/topics/<slug>.ts, see
// server/guide/types.ts) into WebP pictures of the real app with the demo clinic, with numbered markers drawn on them.
//
//   QA_DIST=/tmp/dist-guide QA_PORT=<your port> node store/scripts/guide-shots.mjs [options]
//     --topics=a,b        only these topics (slugs)            --shots=id1,id2   only these shots
//     --langs=ar,en       languages (default both)             --devices=desktop,phone   (default both)
//     --topics-dir=DIR    topic .ts files (default server/guide/topics)
//     --impl-dir=DIR      implementation files (default store/scripts/guide-shots; with --topics-dir, that
//                         directory is looked in first)
//     --out=DIR           pictures and manifest.json (default server/site/img/guide)
//     --jobs=N            lanes run at once (default 2)        --timeout=MS      per shot (default 90000)
//     --list              print every shot and whether it has an implementation and pictures, shoot nothing
// It needs a QA build (window.__dentora): VITE_QA=1 npx vite build --outDir /tmp/dist-guide, served on its own port.
// Exit status 1 when any shot is missing an implementation, failed or timed out; every other shot is still made.
//
// OUTPUT
//   <out>/<lang>/<id>-<width>.webp   desktop at 1600 and 900 px wide, phone at 780 and 390 px; never wider than the
//                                    capture (a narrower one keeps its own width). WebP quality 80, lowered (not
//                                    below 60) while the largest file is over 180 KB.
//   <out>/manifest.json              { "<lang>/<id>": { widths: [1600, 900], width, height, cssWidth } }: width and
//                                    height of the largest file (for the <img> width/height attributes), cssWidth =
//                                    the capture's width in the app's CSS px (a crop is best shown no wider than that)
//   $GUIDE_WORK (default /tmp/dentora-guide-shots-<QA_PORT>): <lang>/<id>.png raw captures, fail/<lang>-<id>.png
//                                    the screen when a shot failed, preview.html every picture of the run with its
//                                    recipe
// Several people can shoot different topics at once (each with their own QA_PORT): the manifest is merged, not
// overwritten.
//
// ====================================================================================================================
// WRITING A SHOT IMPLEMENTATION
// ====================================================================================================================
// One file per topic: store/scripts/guide-shots/<slug>.mjs, with one function per GuideShot id of that topic:
//
//   export const shots = {
//     'patients-list': async ({ page, helpers }) => {
//       await helpers.goto('/patients')
//       return {
//         markers: [
//           { n: 1, target: page.locator('.topbar-search') },
//           { n: 2, target: page.getByRole('button', { name: await helpers.t('patients.newPatient') }) },
//         ],
//       }
//     },
//     'patients-new-form': async ({ page, helpers }) => {
//       await helpers.goto('/patients')
//       await page.getByRole('button', { name: await helpers.t('patients.newPatient') }).click()
//       await page.locator('input[name=name]').fill(helpers.pick('سامر الحلبي', 'Samer Halabi'))
//       return { el: helpers.dialog(), pad: 0, markers: [{ n: 3, target: helpers.dialog().locator('.modal-footer .btn-primary') }] }
//     },
//     // an object instead of a function sets options for that shot:
//     'getting-started-overview': { state: 'fresh', run: async ({ page }) => ({}) },
//   }
//
// The function is called once per language, on the device the GuideShot names (its `device`), and returns a Target
// (below). The same code serves Arabic and English: use helpers.pick(ar, en) for text you type and helpers.t(key) or
// stable selectors ([data-qa], classes, roles) to find things, never one language's words written in the code.
//
// ctx (the function's argument)
//   page      Playwright page, already signed in as the admin (Dr. Ahmad Al-Khatib, PIN 1234) with the demo clinic
//             loaded, in the shot's language, freshly loaded on the dashboard (#/), scrolled to the top
//   lang      'ar' | 'en'            device   'desktop' (1440×900 window, pixel ratio 2) | 'phone' (390×844, ratio 3,
//                                             mobile, touch: the app shows its phone layout with the bottom bar)
//   base      the app's URL, routes are hashes: `${base}#/patients` (helpers.goto('/patients') does it and waits)
//   shot      the GuideShot (id, device, alt, caption, recipe)      topic   the topic's slug
//   helpers   see store/scripts/guide-shots/_helpers.mjs (makeHelpers): pick, t, goto, settle, scrollTo, card,
//             dialog, db, patient, ids, storage, css, noToasts, signOut, lock, signIn, viewport, changedData…
//
// The clock is fixed at Sunday 11 October 2026, 11:40, Asia/Damascus (a working day of the demo clinic) and set back
// to it before every shot; the trial bar is hidden; reports open on last month (as store/scripts/shoot.mjs). The demo
// clinic gets the same record ids at every run, so avatar colours (which follow the ids) match across pictures.
// Every shot starts from the same point: the runner reloads the page, puts localStorage back and, when the previous
// shot changed data (it compares every table after each shot), restores the database; so a shot may freely open
// dialogs, type, save, delete, switch theme or language.
//
// TARGET (what the function returns; every coordinate is in the window's CSS px)
//   {}                          the whole window (also: undefined)
//   { el, pad = 16 }            an element: a Playwright locator or a CSS selector string; a locator that matches
//                               several visible elements, or an array of targets, means the box around all of them
//                               (e.g. [card1, card2] = from the top of one card to the bottom of the other). The
//                               element is scrolled into view (below the top bar) when it is not; one taller than
//                               the window grows the window for that capture, so a whole dialog or card shows
//                               (grow: false keeps the window size). With pad 0 the element keeps its own rounded
//                               corners: the page behind them is made transparent (round: false keeps them square,
//                               round: <px> sets the radius).
//   { clip: { x, y, width, height } }   a fixed part of the window
//   markers: [{ n, target, place?, dx?, dy?, highlight? }]
//       n          the number shown (matches the numbered step of the block; two markers may share a number);
//                  target: locator, selector, box {x, y, width, height}, point {x, y} or an array (their union)
//       place      where the marker sits; by default the runner tries, in order, the spots that suit the target
//                  and takes the first that is inside the picture, touches no other marker and covers nothing:
//                  no text, icon, field, other button or chip, not even the target's own label, and is not as
//                  near to another control or card as to its own target (it would read as pointing there):
//                  - a small target (a button, an icon): beside it on the reading side ('start': left in English,
//                    right in Arabic), the other side ('end'), above, below, then its corners;
//                  - a wide, short one (a field, a row, a menu item): 'start', then just after its own text inside
//                    it ('after-content'), its far end inside it ('inside-end'), 'end', above, below…;
//                  - a block (a card, a panel): its top inner corner on the far side ('inside-top-end'), then its
//                    outer top corners, then its sides.
//                  Nothing free: the spot covering least. Force one with place: 'start' | 'end' | 'top' | 'bottom'
//                  | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'inside-start'
//                  | 'inside-end' | 'inside-top-start' | 'inside-top-end' | 'after-content' | 'center' (start and
//                  end follow the language: write once for both). The run prints where each marker went
//                  ("markers 1:start 2:after-content"); GUIDE_DEBUG=1 prints every spot tried and its cost.
//       dx, dy     a nudge in CSS px after placing (dx > 0 towards the end of the line: right in English, left in
//                  Arabic; dy > 0 down)
//       highlight  true also outlines the target
//   highlights: [target | { target, pad = 4, radius? }]   teal rounded outlines (radius: the element's own + pad)
//   skip: 'reason'              make no picture this time (reported, not a failure)
//
// Markers are teal circles (#0E8F86) with a white number, a white ring and a soft shadow, sized to read about 23 px
// across when the guide shows the picture (desktop pictures about 800 px wide, or narrower crops at their own CSS
// width; phone ones 390 px); outlines read about 3 px, with a faint teal glow. They are drawn in the page just before
// the capture (a layer with pointer-events: none), so they are as sharp as the app, and removed after it.
//
// SHOT OPTIONS (the object form { run, ...options })
//   state     'demo' (default) | 'clinic' (the same clinic and team signed in, no demo records) | 'fresh' (a new
//             installation, nothing in it: the page is on the setup wizard #/setup, nobody signed in; every fresh
//             shot gets its own empty browser profile)
//   viewport  { width, height }  another window size for this shot only
//   timeout   ms for this shot (default --timeout)
//
// TIPS
//   - Wait for what you need (locator.waitFor(), helpers.settle(ms)) rather than fixed pauses; the dashboard and
//     reports draw charts for about a second.
//   - page.goto() reads as Back/Forward to the app, which restores an old scroll position: helpers.goto() holds the
//     window at the top; use helpers.scrollTo(target) to show something lower down.
//   - Find demo records by what they are (helpers.patient('name'), helpers.ids(), helpers.db(fn)), never by an id
//     copied from a run: ids differ between Arabic and English. The team's ids are fixed: u-admin, u-doc2, u-rec.
//   - Run your topic alone while writing it: node store/scripts/guide-shots.mjs --topics=<slug> --langs=ar, and look
//     at $GUIDE_WORK/preview.html. Each line shows the seconds spent in your function + the capture + the encoding.
//   - A failed shot leaves a picture of the screen at that moment in $GUIDE_WORK/fail/ and the error names the line
//     of your file.
//   - helpers.t() reads the app's dictionaries from GUIDE_SRC (default dental/src); point it at the source the QA
//     build was made from when they differ.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { startServer, DIST } from '../../scripts/qa/lib.mjs'
import * as H from './guide-shots/_helpers.mjs'

const ROOT = H.ROOT
const argv = process.argv.slice(2)
const opt = (name, def) => { const a = argv.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def }
const list = (name, def) => (opt(name, def) || '').split(',').map(s => s.trim()).filter(Boolean)
const known = ['topics', 'shots', 'langs', 'devices', 'topics-dir', 'impl-dir', 'out', 'jobs', 'timeout', 'list']
for (const a of argv) if (!known.includes(a.replace(/^--/, '').split('=')[0])) { console.error(`unknown option ${a}`); process.exit(2) }

const DEFAULT_TOPICS = path.join(ROOT, 'server/guide/topics')
const DEFAULT_IMPL = path.join(ROOT, 'store/scripts/guide-shots')
const TOPICS_DIR = path.resolve(opt('topics-dir', DEFAULT_TOPICS))
const IMPL_DIRS = opt('impl-dir') ? [path.resolve(opt('impl-dir'))] : TOPICS_DIR === DEFAULT_TOPICS ? [DEFAULT_IMPL] : [TOPICS_DIR, DEFAULT_IMPL]
const OUT = path.resolve(opt('out', path.join(ROOT, 'server/site/img/guide')))
const LANGS = list('langs', 'ar,en')
const DEVICE_NAMES = list('devices', 'desktop,phone')
const ONLY_TOPICS = list('topics', '')
const ONLY_SHOTS = list('shots', '')
const JOBS = Math.max(1, Number(opt('jobs', 2)) || 2)
const TIMEOUT = Number(opt('timeout', 90000)) || 90000
const LIST = argv.includes('--list')
const WORK = H.tmpDir()
const STATES = ['demo', 'clinic', 'fresh']
for (const l of LANGS) if (!['ar', 'en'].includes(l)) { console.error(`unknown language ${l}`); process.exit(2) }
for (const d of DEVICE_NAMES) if (!H.DEVICES[d]) { console.error(`unknown device ${d}`); process.exit(2) }

const rel = p => (path.relative(ROOT, p).startsWith('..') ? p : path.relative(ROOT, p))
const problems = { missing: [], failed: [], timeout: [] }
const warnings = []

// ---- topics and implementations ----------------------------------------------------------------------------------
const topics = []
let topicLoadErrors = 0
for (const f of fs.readdirSync(TOPICS_DIR).filter(f => f.endsWith('.ts') && !f.startsWith('_')).sort()) {
  try {
    const t = (await import(pathToFileURL(path.join(TOPICS_DIR, f)).href)).default
    if (!t || typeof t.slug !== 'string' || !Array.isArray(t.shots)) throw new Error('no default export with slug and shots')
    topics.push(t)
  } catch (e) { topicLoadErrors++; console.error(`TOPIC ${f}: ${e.message}`) }
}
topics.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
{
  const seen = new Map()
  for (const t of topics) for (const s of t.shots) {
    if (seen.has(s.id)) warnings.push(`shot id ${s.id} is in both ${seen.get(s.id)} and ${t.slug}`)
    seen.set(s.id, t.slug)
    if (!s.id.startsWith(`${t.slug}-`)) warnings.push(`shot id ${s.id} does not start with its topic's slug '${t.slug}-'`)
    if (!H.DEVICES[s.device]) warnings.push(`shot ${s.id}: unknown device '${s.device}'`)
  }
}
for (const slug of ONLY_TOPICS) if (!topics.some(t => t.slug === slug)) { console.error(`no topic '${slug}' in ${rel(TOPICS_DIR)}`); process.exit(2) }

async function loadImpl(slug) {
  for (const dir of IMPL_DIRS) {
    const file = path.join(dir, `${slug}.mjs`)
    if (!fs.existsSync(file)) continue
    try {
      const m = await import(pathToFileURL(file).href)
      if (!m.shots || typeof m.shots !== 'object') return { file, error: 'it has no `export const shots = { ... }`' }
      return { file, shots: m.shots }
    } catch (e) { return { file, error: `it does not load: ${e.message}` } }
  }
  return { file: path.join(IMPL_DIRS[IMPL_DIRS.length - 1], `${slug}.mjs`), error: 'no such file' }
}
function normalise(entry) {
  if (typeof entry === 'function') return { run: entry, state: 'demo' }
  if (entry && typeof entry === 'object' && typeof entry.run === 'function') {
    const state = entry.state || 'demo'
    if (!STATES.includes(state)) throw new Error(`unknown state '${state}' (${STATES.join(', ')})`)
    return { ...entry, state }
  }
  throw new Error('an implementation is a function or { run, state?, viewport?, timeout? }')
}

const jobs = []
for (const topic of topics) {
  if (ONLY_TOPICS.length && !ONLY_TOPICS.includes(topic.slug)) continue
  const shots = topic.shots.filter(s => (!ONLY_SHOTS.length || ONLY_SHOTS.includes(s.id)) && DEVICE_NAMES.includes(s.device))
  if (!shots.length) continue
  const impl = await loadImpl(topic.slug)
  if (impl.shots) for (const id of Object.keys(impl.shots)) if (!topic.shots.some(s => s.id === id)) warnings.push(`${rel(impl.file)}: '${id}' is not a shot of topic ${topic.slug}`)
  for (const lang of LANGS) for (const shot of shots) {
    const key = `${lang}/${shot.id}`
    let entry = null, why = null
    if (impl.error) why = `${rel(impl.file)}: ${impl.error}`
    else if (!impl.shots[shot.id]) why = `${rel(impl.file)} has no '${shot.id}'`
    else { try { entry = normalise(impl.shots[shot.id]) } catch (e) { why = `${rel(impl.file)} '${shot.id}': ${e.message}` } }
    if (!entry) { problems.missing.push({ key, why }); continue }
    jobs.push({ key, lang, topic, shot, impl: entry, file: impl.file })
  }
}
for (const id of ONLY_SHOTS) if (!topics.some(t => t.shots.some(s => s.id === id))) warnings.push(`--shots: no shot '${id}' in any topic`)

// ---- manifest ----------------------------------------------------------------------------------------------------
// Several people may shoot their topics at the same time into the same folder: every write reads the file again and
// changes only the entries this run made or dropped.
const MANIFEST = path.join(OUT, 'manifest.json')
const readManifest = () => { try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) } catch { return {} } }
const manifest = readManifest()
const changed = new Map()            // key → entry, or null for a dropped one
function setEntry(key, entry) { changed.set(key, entry); if (entry) manifest[key] = entry; else delete manifest[key]; writeManifest() }
function writeManifest() {
  fs.mkdirSync(OUT, { recursive: true })
  const now = readManifest()
  for (const [k, v] of changed) { if (v) now[k] = v; else delete now[k] }
  // one line per picture, in order: small diffs
  const lines = Object.keys(now).sort().map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(now[k])}`)
  const tmp = `${MANIFEST}.${process.pid}.tmp`
  fs.writeFileSync(tmp, lines.length ? `{\n${lines.join(',\n')}\n}\n` : '{}\n')
  fs.renameSync(tmp, MANIFEST)
}

if (LIST) {
  const rows = []
  for (const topic of topics) {
    if (ONLY_TOPICS.length && !ONLY_TOPICS.includes(topic.slug)) continue
    const impl = await loadImpl(topic.slug)
    for (const s of topic.shots) {
      if (ONLY_SHOTS.length && !ONLY_SHOTS.includes(s.id)) continue
      const has = impl.shots?.[s.id] ? 'yes' : 'NO'
      const pics = LANGS.map(l => (manifest[`${l}/${s.id}`] ? l : '--')).join(' ')
      rows.push(`${s.id.padEnd(40)} ${s.device.padEnd(8)} impl ${has.padEnd(4)} pictures ${pics}`)
    }
  }
  console.log(rows.join('\n'))
  for (const w of warnings) console.log('WARNING', w)
  process.exit(0)
}

// ---- running -----------------------------------------------------------------------------------------------------
class Timeout extends Error {}
function withTimeout(promise, ms, what) {
  let timer
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Timeout(`${what} took longer than ${ms} ms`)), ms) })]).finally(() => clearTimeout(timer))
}
/** The first line of an error, and where in the implementation file it happened. */
function explain(e, file) {
  const msg = String(e?.message || e).split('\n').filter(l => l.trim() && !/^\s*=+/.test(l))[0]
  const at = String(e?.stack || '').split('\n').find(l => file && l.includes(path.basename(file)))
  return at ? `${msg} (${at.trim().replace(/^at\s+/, '').replace(pathToFileURL(path.dirname(file)).href + '/', '')})` : msg
}
const pngWidth = buf => buf.readUInt32BE(16)
const sec = ms => (ms / 1000).toFixed(1)

const made = []
let encodeQueue = Promise.resolve()

async function shoot(page, lane, job) {
  const t0 = Date.now()
  const shotState = { dirty: false }
  const helpers = H.makeHelpers(page, lane, shotState)
  const errors = []
  const onErr = e => errors.push(e.message || String(e))
  page.on('pageerror', onErr)
  try {
    if (job.impl.viewport) await page.setViewportSize(job.impl.viewport)
    const ctx = { page, lang: job.lang, device: lane.device, base: H.APP, shot: job.shot, topic: job.topic.slug, helpers }
    const timeout = job.impl.timeout || TIMEOUT
    const target = await withTimeout(Promise.resolve().then(() => job.impl.run(ctx)), timeout, 'the shot')
    if (target && target.skip) { console.log(`skip  ${job.key}: ${target.skip}`); return { shotState, skipped: true } }
    const t1 = Date.now()
    const rtl = await page.evaluate(() => getComputedStyle(document.documentElement).direction === 'rtl')
    const { png, css, radius, placed } = await withTimeout(H.captureTarget(page, lane.device, target, { rtl }), 30000, 'the capture')
    const t2 = Date.now()
    const raw = path.join(WORK, job.lang, `${job.shot.id}.png`)
    fs.mkdirSync(path.dirname(raw), { recursive: true })
    fs.writeFileSync(raw, png)
    const widths = H.widthsFor(lane.device, pngWidth(png))
    const dir = path.join(OUT, job.lang)
    fs.mkdirSync(dir, { recursive: true })
    // encode in the background while the next shot runs; files of widths no longer made go
    encodeQueue = encodeQueue.then(async () => {
      try {
        for (const f of fs.readdirSync(dir)) {
          const m = f.match(/^(.+)-(\d+)\.webp$/)
          if (m && m[1] === job.shot.id && !widths.includes(Number(m[2]))) fs.rmSync(path.join(dir, f))
        }
        const t3 = Date.now()
        const files = await H.encodeWebp(raw, path.join(dir, job.shot.id), widths, { radius: Math.round(radius * H.DEVICES[lane.device].scale) })
        setEntry(job.key, { widths, width: files[0].width, height: files[0].height, cssWidth: Math.round(css.width) })
        const big = files[0].bytes > H.MAX_BYTES
        if (big) warnings.push(`${job.key}: ${files[0].width} px file is ${Math.round(files[0].bytes / 1024)} KB even at quality ${files[0].quality}`)
        made.push({ job, files, css, device: lane.device, ms: Date.now() - t0 })
        console.log(`ok    ${job.key.padEnd(46)} ${lane.device.padEnd(7)} ${files.map(f => `${f.width}w ${Math.round(f.bytes / 1024)}KB`).join(' · ')}${files[0].quality !== H.QUALITY ? ` (q${files[0].quality})` : ''}  ${sec(t1 - t0)} + ${sec(t2 - t1)} + ${sec(Date.now() - t3)}s${placed.length ? `  markers ${placed.join(' ')}` : ''}`)
      } catch (e) { problems.failed.push({ key: job.key, why: `encoding: ${e.message}` }) }
    })
    if (errors.length) warnings.push(`${job.key}: page errors: ${[...new Set(errors)].slice(0, 3).join(' | ')}`)
    return { shotState }
  } finally {
    page.off('pageerror', onErr)
  }
}

async function failShot(page, job, e) {
  const timedOut = e instanceof Timeout
  const shotFile = path.join(WORK, 'fail', `${job.lang}-${job.shot.id}.png`)
  try { fs.mkdirSync(path.dirname(shotFile), { recursive: true }); await page.screenshot({ path: shotFile, timeout: 5000 }) } catch { /* the page is gone */ }
  const why = `${explain(e, job.file)}  [screen: ${shotFile}]`
  ;(timedOut ? problems.timeout : problems.failed).push({ key: job.key, why })
  console.log(`${timedOut ? 'TIME ' : 'FAIL '} ${job.key}: ${why}`)
}

async function runLane(browser, lane) {
  const label = `${lane.lang}/${lane.device}/${lane.state}`
  if (lane.state === 'fresh') {
    for (const job of lane.jobs) {
      const { ctx, page } = await H.newContext(browser, lane.device, lane.lang)
      try {
        await H.prepareState(page, 'fresh', lane.lang)
        await shoot(page, lane, job)
      } catch (e) { await failShot(page, job, e) } finally { await ctx.close().catch(() => {}) }
    }
    return
  }
  let { ctx, page } = await H.newContext(browser, lane.device, lane.lang)
  try {
    const t0 = Date.now()
    try {
      await H.prepareState(page, lane.state, lane.lang)
      await H.snapshotDb(page)
      lane.local = await H.readLocal(page)
      lane.base = await H.fingerprint(page)
    } catch (e) {
      for (const job of lane.jobs) problems.failed.push({ key: job.key, why: `preparing ${label}: ${e.message}` })
      console.log(`FAIL  lane ${label}: ${e.message}`)
      return
    }
    console.log(`lane  ${label}: ready in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${lane.jobs.length} shot(s)`)
    let dirty = false
    for (const job of lane.jobs) {
      try {
        await withTimeout(H.resetPage(page, lane, { dirty }), 60000, 'resetting the page')
        dirty = false
      } catch (e) {
        // a page that cannot be reset: start a new tab on the same database, restored
        await page.close().catch(() => {})
        page = await ctx.newPage()
        try { await H.resetPage(page, lane, { dirty: true }) } catch (e2) {
          for (const j of lane.jobs.slice(lane.jobs.indexOf(job))) problems.failed.push({ key: j.key, why: `lane ${label} broken: ${e2.message}` })
          return
        }
      }
      try {
        const { shotState } = await shoot(page, lane, job)
        const fp = await withTimeout(H.fingerprint(page), 20000, 'reading the database').catch(() => null)
        dirty = shotState.dirty || !H.sameFingerprint(fp, lane.base)
      } catch (e) {
        await failShot(page, job, e)
        // what the failed shot left running may still act on this tab: drop it, restore the data in a new one
        await page.close().catch(() => {})
        page = await ctx.newPage()
        dirty = true
      }
    }
  } finally {
    await ctx.close().catch(() => {})
  }
}

// ---- main --------------------------------------------------------------------------------------------------------
const lanes = new Map()
for (const job of jobs) {
  const k = `${job.lang}|${job.shot.device}|${job.impl.state}`
  if (!lanes.has(k)) lanes.set(k, { lang: job.lang, device: job.shot.device, state: job.impl.state, jobs: [] })
  lanes.get(k).jobs.push(job)
}
const started = Date.now()
console.log(`guide-shots: ${jobs.length} shot(s) in ${lanes.size} lane(s), ${problems.missing.length} without implementation · ${DIST} · ${await H.encoderName()} · out ${rel(OUT)}`)
if (jobs.length) {
  const server = await startServer()
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  try {
    const queue = [...lanes.values()]
    await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
      while (queue.length) await runLane(browser, queue.shift())
    }))
    await encodeQueue
  } finally {
    await browser.close().catch(() => {})
    server.kill()
  }
}

// a full run of the guide's own topics drops the pictures of shots that no longer exist
if (!ONLY_TOPICS.length && !ONLY_SHOTS.length && TOPICS_DIR === DEFAULT_TOPICS && !topicLoadErrors && LANGS.length === 2 && DEVICE_NAMES.length === 2) {
  const ids = new Set(topics.flatMap(t => t.shots.map(s => s.id)))
  for (const key of Object.keys(manifest)) {
    const [lang, id] = key.split('/')
    if (ids.has(id)) continue
    for (const w of manifest[key].widths || []) fs.rmSync(path.join(OUT, lang, `${id}-${w}.webp`), { force: true })
    setEntry(key, null)
    console.log(`drop  ${key} (no longer in the guide)`)
  }
}

// the run's pictures on one page, for checking them by eye
if (made.length || problems.failed.length || problems.timeout.length) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const cards = made.sort((a, b) => a.job.key.localeCompare(b.job.key)).map(({ job, files, css, device }) => {
    const src = pathToFileURL(path.join(OUT, job.lang, `${job.shot.id}-${files[0].width}.webp`)).href
    const shown = Math.min(css.width, H.DEVICES[device].display)
    return `<section dir="${job.lang === 'ar' ? 'rtl' : 'ltr'}"><h2>${esc(job.key)} <small>${device} · ${files.map(f => `${f.width}×${f.height} ${Math.round(f.bytes / 1024)} KB`).join(' · ')}</small></h2>`
      + `<img src="${src}" style="width:${shown}px" alt="${esc(job.shot.alt?.[job.lang])}"><p>${esc(job.shot.alt?.[job.lang])}</p><details dir="ltr"><summary>recipe</summary><p>${esc(job.shot.recipe)}</p></details></section>`
  }).join('\n')
  const fails = [...problems.failed, ...problems.timeout].map(p => `<li><b>${esc(p.key)}</b> ${esc(p.why)}</li>`).join('')
  fs.mkdirSync(WORK, { recursive: true })
  fs.writeFileSync(path.join(WORK, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Guide shots</title><style>body{font:14px system-ui,sans-serif;background:#f1f5f9;margin:24px}section{background:#fff;border-radius:12px;padding:16px;margin:0 0 20px;max-width:840px}img{max-width:100%;border:1px solid #e2e8f0;border-radius:8px;display:block}h2{font-size:15px;margin:0 0 10px}small{color:#64748b;font-weight:400}</style>${fails ? `<section><h2>Failed</h2><ul>${fails}</ul></section>` : ''}${cards}`)
}

const secs = Math.round((Date.now() - started) / 1000)
console.log(`\nmade ${made.length} picture set(s) in ${secs}s · missing ${problems.missing.length} · failed ${problems.failed.length} · timed out ${problems.timeout.length}`)
for (const w of warnings) console.log('WARNING ', w)
for (const p of problems.missing) console.log('MISSING ', p.key.padEnd(46), p.why)
for (const p of problems.failed) console.log('FAILED  ', p.key.padEnd(46), p.why)
for (const p of problems.timeout) console.log('TIMEOUT ', p.key.padEnd(46), p.why)
if (made.length) console.log(`preview: ${path.join(WORK, 'preview.html')}`)
process.exit(problems.missing.length + problems.failed.length + problems.timeout.length ? 1 : 0)
