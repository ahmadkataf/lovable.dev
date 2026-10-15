// The video course recorder (docs/VIDEOS.md is the contract): runs a chapter script (chapters/<slug>.mjs) in Chromium
// on the QA build with the demo clinic, speaks the narration with edge-tts (Microsoft neural voices), films the screen
// through the DevTools screencast with a visible cursor and assembles the chapter with ffmpeg. It needs a QA build
// (one with window.__dentora) served on its own port, ffmpeg and ffprobe, and edge-tts (pip install edge-tts):
//   VITE_QA=1 npx vite build --outDir /tmp/dist-video
//   QA_DIST=/tmp/dist-video QA_PORT=4861 node store/scripts/video/make.mjs [--chapters=a,b] [--langs=ar,en] [--scene=id] [--keep-work]
// --chapters   which chapters (default: every chapters/<slug>.mjs whose name does not start with _; _sample is a test)
// --langs      which languages (default ar,en)
// --scene=id   records only that scene (the scenes before it are played first, without narration, to reach its
//              state), with the cards, into $VIDEO_WORK/scene/<lang>/<slug>--<id>.mp4, to check one scene quickly
// --keep-work  keeps the frames and the mixed narration in $VIDEO_WORK/rec/<lang>/<slug>/ after assembling
// Environment: VIDEO_WORK (default /tmp/dentora-video-work: the narration cache tts/ and the recordings rec/),
// VIDEO_OUT (default server/site/videos, git-ignored: published, not committed), VIDEO_VOICE_AR / VIDEO_VOICE_EN,
// VIDEO_RATE_AR / VIDEO_RATE_EN (e.g. -5%), VIDEO_NOW (the fixed clock).
// Output per chapter and language: <lang>/<slug>.mp4 (H.264 30 fps 1920×1080 + AAC mono, a 3 s title card, a 2 s end
// card), <lang>/<slug>.vtt (captions), <lang>/<slug>.jpg (poster) and the entry in manifest.json.
// A chapter that fails does not stop the others; the exit code is 1 with the list of failures at the end. A narration
// that cannot be synthesised (the voice service is unreachable) stops everything before Chromium starts.
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { startServer, DIST } from '../../../scripts/qa/lib.mjs'
import { checkTts, synthesizeAll, wordCount, TtsError, VOICES, RATES } from './lib/tts.mjs'
import { launchBrowser, newClinicPage, loadClinic } from './lib/clinic.mjs'
import { createUi } from './lib/ui.mjs'
import { titleCardHtml, endCardHtml, showCard, hideCard } from './lib/cards.mjs'
import { startScreencast } from './lib/screencast.mjs'
import { assemble } from './lib/assemble.mjs'
import { listChapterScripts, loadChapter, loadIndex, chapterCards, INDEX_TS } from './lib/chapters.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const arg = (name, def) => (process.argv.find(a => a.startsWith(`--${name}=`)) || `--${name}=${def}`).split('=')[1].split(',').filter(Boolean)
const CHAPTERS = arg('chapters', '')
const LANGS = arg('langs', 'ar,en')
const SCENE = arg('scene', '')[0] || ''
const KEEP = process.argv.includes('--keep-work')
const WORK = process.env.VIDEO_WORK || '/tmp/dentora-video-work'
const OUT = SCENE ? path.join(WORK, 'scene') : (process.env.VIDEO_OUT || path.join(ROOT, 'server/site/videos'))
// the contract's timing: a 3 s title card, the narration starts and `run` follows 300 ms later, the scene ends when
// both the narration (plus 600 ms) and `run` are done, a 2 s end card
const TITLE_MS = 3000, FADE_MS = 350, LEAD_MS = 300, TAIL_MS = 600, END_MS = 2000

const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)))
const log = (...a) => console.log('make:', ...a)
const rel = p => (path.relative(ROOT, p).startsWith('..') ? p : path.relative(ROOT, p))
const mib = n => `${(n / 1048576).toFixed(1)} MiB`
const since = t => `${((Date.now() - t) / 1000).toFixed(1)} s`
const started = Date.now()

// ---- preflight: tools, chapter scripts, the course index --------------------------------------------------------
const tool = async (name) => { try { await promisify(execFile)(name, ['-version']) } catch { throw new Error(`${name} is not installed (apt install ffmpeg)`) } }
await tool('ffmpeg'); await tool('ffprobe')
log(`edge-tts ${await checkTts()}; voices ${LANGS.map(l => `${l}: ${VOICES[l]}${RATES[l] === '+0%' ? '' : ` ${RATES[l]}`}`).join(', ')}`)
for (const lang of LANGS) if (!VOICES[lang]) { console.error(`make: no voice for language "${lang}" (ar or en)`); process.exit(2) }
const index = await loadIndex()
log(index ? `chapter list: ${index.length} chapters in ${rel(INDEX_TS)}` : `no ${rel(INDEX_TS)} yet: titles from the scripts, next chapter unknown`)
const slugs = CHAPTERS.length ? CHAPTERS : listChapterScripts()
if (!slugs.length) { console.error('make: no chapter scripts in store/scripts/video/chapters/ (pass --chapters=…)'); process.exit(2) }
const chapters = []
for (const slug of slugs) chapters.push(await loadChapter(slug))
log(`chapters ${slugs.join(', ')}; languages ${LANGS.join(', ')}; output ${rel(OUT)}${SCENE ? ` (scene ${SCENE} only)` : ''}`)

// ---- the narration first: the recorder needs every duration before it films, and a voice-service failure should
// stop the run before Chromium starts ---------------------------------------------------------------------------
const jobs = []
try {
  for (const chapter of chapters) {
    const at = SCENE ? chapter.scenes.findIndex(s => s.id === SCENE) : 0
    if (at < 0) throw new Error(`${chapter.slug} has no scene "${SCENE}" (${chapter.scenes.map(s => s.id).join(', ')})`)
    const scenes = SCENE ? [chapter.scenes[at]] : chapter.scenes
    const setup = SCENE ? chapter.scenes.slice(0, at) : []     // played without narration before the recording starts
    for (const lang of LANGS) {
      const t = Date.now()
      const texts = scenes.map(s => s.say[lang].replace(/\s+/g, ' ').trim())
      const audio = await synthesizeAll(texts.map(text => ({ text, lang })), { work: WORK })
      const cached = audio.filter(a => a.cached).length
      const words = texts.reduce((n, x) => n + wordCount(x), 0), seconds = audio.reduce((n, a) => n + a.duration, 0)
      log(`${lang}/${chapter.slug}: narration ${scenes.length} scenes, ${seconds.toFixed(1)} s (${cached} cached, ${scenes.length - cached} new, ${since(t)}), ${(words / seconds).toFixed(2)} words/s`)
      jobs.push({ chapter, lang, setup, scenes: scenes.map((s, i) => ({ ...s, text: texts[i], audio: audio[i] })) })
    }
  }
} catch (e) {
  console.error(`make: ${e instanceof TtsError ? 'narration failed: ' : ''}${e.message}`)
  process.exit(1)
}

// ---- recording -------------------------------------------------------------------------------------------------
/** The manifest at OUT, updated entry by entry (recording one chapter never drops the others). */
function writeManifest(key, entry) {
  const file = path.join(OUT, 'manifest.json')
  let m = {}
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* none yet, or broken: rebuilt from here */ }
  m[key] = entry
  fs.writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n')
}

async function record(browser, { chapter, lang, setup, scenes }) {
  const tag = `${lang}/${chapter.slug}`
  const t = Date.now()
  const work = path.join(WORK, 'rec', lang, chapter.slug)
  fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(work, { recursive: true })
  const { ctx, page, errors } = await newClinicPage(browser, lang)
  let rec = null
  try {
    const counts = await loadClinic(page, lang)
    log(`${tag}: demo clinic loaded (${counts.patients} patients, ${since(t)})`)
    const ui = createUi(page, { lang })
    const sceneCtx = { page, ui, lang, device: 'desktop' }
    if (chapter.before) await chapter.before(sceneCtx)
    for (const s of setup) { log(`${tag}: playing scene ${s.id} without narration`); await s.run(sceneCtx) }
    await ui.ensure()
    const cards = chapterCards(index, chapter, lang)
    await showCard(page, titleCardHtml({ lang, number: cards.number, title: cards.title }))
    await page.waitForTimeout(150)
    rec = await startScreencast(page, path.join(work, 'frames'))
    const t0 = await rec.firstFrame()                 // the video's zero: the first frame, showing the title card
    const now = () => Date.now() / 1000 - t0
    await sleep(TITLE_MS - FADE_MS - now() * 1000)
    await hideCard(page, FADE_MS)
    const poster = path.join(work, 'poster.jpg')      // the first frame of the first scene, 1280×720
    await page.screenshot({ path: poster, type: 'jpeg', quality: 88, scale: 'css' })
    const timeline = []
    for (const s of scenes) {
      const start = now()
      timeline.push({ id: s.id, start, text: s.text, file: s.audio.file, duration: s.audio.duration, cues: s.audio.cues })
      log(`${tag}: scene ${s.id} at ${start.toFixed(2)} s (narration ${s.audio.duration.toFixed(1)} s)`)
      const narration = sleep(s.audio.duration * 1000 + TAIL_MS)
      const action = (async () => { await sleep(LEAD_MS); await s.run(sceneCtx) })().catch(e => { throw new Error(`scene ${s.id}: ${e.message.split('\n')[0]}`) })
      await Promise.all([narration, action])
    }
    await showCard(page, endCardHtml({ lang, next: cards.next }))
    await sleep(END_MS)
    const total = now()
    const frames = await rec.stop()
    rec = null
    await ctx.close()
    fs.writeFileSync(path.join(work, 'frames.json'), JSON.stringify({ t0, total, scenes: timeline.map(({ id, start }) => ({ id, start })), frames: frames.map(f => ({ i: f.i, at: Math.round((f.ts - t0) * 10000) / 10000 })) }))
    const recorded = Date.now()
    log(`${tag}: recorded ${total.toFixed(1)} s in ${since(t)} (${frames.length} frames); assembling…`)
    const outDir = path.join(OUT, lang)
    fs.mkdirSync(outDir, { recursive: true })
    const base = SCENE ? `${chapter.slug}--${SCENE}` : chapter.slug
    const out = { mp4: path.join(outDir, `${base}.mp4`), vtt: path.join(outDir, `${base}.vtt`), jpg: path.join(outDir, `${base}.jpg`) }
    const { entry, crf, probe, frames: used } = await assemble({ frames, t0, total, scenes: timeline, out, work, log: m => log(`${tag}: ${m}`) })
    fs.copyFileSync(poster, out.jpg)
    writeManifest(`${lang}/${SCENE ? base : chapter.slug}`, entry)
    log(`${tag}: ${entry.durationSeconds} s, ${mib(entry.sizeBytes)} at crf ${crf}, ${probe.width}×${probe.height} ${probe.fps} fps, ${used} frames, assembled in ${since(recorded)} → ${rel(out.mp4)}`)
    if (errors.length) log(`${tag}: ${errors.length} console error(s) while recording: ${[...new Set(errors)].slice(0, 3).join(' | ')}`)
    if (!KEEP) for (const f of ['frames', 'frames.txt', 'narration.wav']) fs.rmSync(path.join(work, f), { recursive: true, force: true })
    return { tag, seconds: entry.durationSeconds, wall: (Date.now() - t) / 1000, bytes: entry.sizeBytes }
  } finally {
    if (rec) await rec.stop().catch(() => {})
    await ctx.close().catch(() => {})
  }
}

process.on('SIGINT', () => process.exit(130))   // the exit handlers close Chromium and the preview server
const server = await startServer()
const browser = await launchBrowser()
const made = [], failures = []
try {
  for (const job of jobs) {
    try { made.push(await record(browser, job)) } catch (e) {
      failures.push(`${job.lang}/${job.chapter.slug}: ${e.message}`)
      log(`${job.lang}/${job.chapter.slug}: FAILED: ${e.message}`)
    }
  }
} finally {
  await browser.close().catch(() => {})
  server.kill()
}
const seconds = made.reduce((n, m) => n + m.seconds, 0), wall = made.reduce((n, m) => n + m.wall, 0)
log(`${made.length} video(s), ${seconds.toFixed(0)} s of video in ${since(started)}${made.length ? ` (${(wall / seconds * 60).toFixed(0)} s per minute of video, demo clinic and assembly included)` : ''} (${DIST})`)
if (failures.length) {
  console.error(`make: ${failures.length} failure(s):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
