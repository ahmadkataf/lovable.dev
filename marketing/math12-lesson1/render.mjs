// Render lesson.html to video. Splits the frame range across parallel Chromium workers; each pipes
// JPEG frames into its own ffmpeg, then the segments are concatenated without re-encoding.
//   node render.mjs out.mp4 [--from 0] [--to <sec>] [--fps 30] [--workers 3] [--crf 18]
//   node render.mjs --stills dir t1,t2,...      (PNG stills at given seconds, for review)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL, fileURLToPath } from 'url'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const here = path.dirname(fileURLToPath(import.meta.url))
const page = pathToFileURL(path.join(here, 'lesson.html')).href
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }

async function open(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  p.on('pageerror', e => console.error('pageerror:', e.message))
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()) })
  await p.goto(page + (opt('sub') ? '?sub=1' : ''))
  await p.evaluate(() => window.READY)
  await p.waitForTimeout(200)
  return p
}

if (args[0] === '--stills' || args[0] === '--scene') {
  // --stills dir t1,t2,…   absolute seconds
  // --scene id dir [--every 0]   one still near the start, middle and end of every line of that scene
  //                               (or one every N seconds with --every N); file names say line + moment
  const tl = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'))
  let dir, shots
  if (args[0] === '--stills') {
    dir = args[1]; shots = args[2].split(',').map(Number).map(t => [t, `t${t.toFixed(2).padStart(7, '0')}`])
  } else {
    const sc = tl.scenes.find(s => s.id === args[1])
    if (!sc) { console.error('no scene ' + args[1]); process.exit(1) }
    dir = args[2]; shots = []
    const every = +opt('every', 0)
    if (every) for (let t = sc.start + .05; t < sc.end; t += every) shots.push([t, `${sc.id}_${(t - sc.start).toFixed(1).padStart(5, '0')}s`])
    else {
      sc.lines.forEach((l, i) => {
        const L = String(i).padStart(2, '0')
        shots.push([l.start + .7, `${sc.id}_l${L}_a`], [(l.start + l.end) / 2, `${sc.id}_l${L}_b`], [l.end - .05, `${sc.id}_l${L}_c`])
      })
      shots.push([sc.end - .45, `${sc.id}_zend`])
    }
  }
  fs.mkdirSync(dir, { recursive: true })
  const b = await chromium.launch()
  const p = await open(b)
  for (const [t, name] of shots) {
    await p.evaluate(t => render(t), t)
    await p.screenshot({ path: path.join(dir, name + '.png') })
  }
  await b.close()
  console.log(`${shots.length} stills → ${dir}`)
  process.exit(0)
}

const out = path.resolve(args[0])
const fps = +opt('fps', 30), workers = +opt('workers', 3), crf = opt('crf', '18')
const tl = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'))
const from = Math.round(+opt('from', 0) * fps), to = Math.round(+opt('to', tl.total) * fps)
const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.seg-'))
const per = Math.ceil((to - from) / workers)
const t0 = Date.now()
let done = 0

async function worker(k) {
  const a = from + k * per, z = Math.min(to, a + per)
  if (a >= z) return null
  const seg = path.join(tmp, `seg${k}.mp4`)
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(fps), seg], { stdio: ['pipe', 'inherit', 'inherit'] })
  const b = await chromium.launch()
  const p = await open(b)
  for (let f = a; f < z; f++) {
    await p.evaluate(t => render(t), f / fps)
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 })
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r))
    if (++done % 300 === 0) {
      const el = (Date.now() - t0) / 1000
      console.log(`${done}/${to - from} frames  ${(done / el).toFixed(1)} fps  eta ${((to - from - done) / (done / el) / 60).toFixed(1)} min`)
    }
  }
  ff.stdin.end()
  await new Promise(r => ff.on('close', r))
  await b.close()
  return seg
}

const segs = (await Promise.all(Array.from({ length: workers }, (_, k) => worker(k)))).filter(Boolean)
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'))
await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' })
  .on('close', c => (c ? rej(new Error('concat failed')) : res())))
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`wrote ${out} (${((to - from) / fps).toFixed(1)} s) in ${((Date.now() - t0) / 60000).toFixed(1)} min`)
