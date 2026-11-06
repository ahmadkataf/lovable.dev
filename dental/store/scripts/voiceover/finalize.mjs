// The last step of the Gemini voice-over: puts the narration on a chapter re-recorded with it, with add_voice.py
// (store/scripts/voiceover/, from the owner's brief): every scene clip at the second its scene starts in the video
// (recorded/manifest.json), the video stream copied untouched, the narration loudness-normalised (-16 LUFS, AAC 192k).
//   node store/scripts/voiceover/finalize.mjs <slug> [--recorded=<dir>] [--narration=<dir>] [--out=<dir>]
// Defaults: recorded/ (VIDEO_OUT of the recording), narration/ (split.mjs's clips), final/. Writes <out>/<slug>.mp4
// (the original video's name) with its captions <slug>.vtt and poster <slug>.jpg next to it, checks the result with
// ffprobe (a video and an audio stream, the recording's duration) and, for the default folders, sets the chapter's
// row of manifest.csv to start_sec = the first scene's start and status = final.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { readManifest, writeManifest } from './build-scripts.mjs'

const run = promisify(execFile)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORK = path.resolve(HERE, '../../voiceover')
const opt = (name, def) => (process.argv.find(a => a.startsWith(`--${name}=`)) || `=${def}`).split('=').slice(1).join('=')

const slug = process.argv[2]
if (!slug || slug.startsWith('--')) { console.error('usage: finalize.mjs <slug> [--recorded=dir] [--narration=dir] [--out=dir]'); process.exit(2) }
const recorded = path.resolve(opt('recorded', path.join(WORK, 'recorded')))
const narration = path.resolve(opt('narration', path.join(WORK, 'narration')))
const out = path.resolve(opt('out', path.join(WORK, 'final')))
const entry = JSON.parse(fs.readFileSync(path.join(recorded, 'manifest.json'), 'utf8'))[`ar/${slug}`]
if (!entry) throw new Error(`no ar/${slug} in ${recorded}/manifest.json`)
const video = path.join(recorded, 'ar', `${slug}.mp4`)
const clips = entry.scenes.map(s => {
  const file = path.join(narration, 'ar', slug, `${s.id}.wav`)
  if (!fs.existsSync(file)) throw new Error(`missing clip ${file}`)
  return `${file}@${s.start}`
})
fs.mkdirSync(out, { recursive: true })
const target = path.join(out, `${slug}.mp4`)
const { stdout, stderr } = await run('python3', [path.join(HERE, 'add_voice.py'), '--video', video, ...clips.flatMap(c => ['--clip', c]), '--out', target, '--mode', 'replace'], { maxBuffer: 64 << 20 })
if (stderr.trim()) console.error(stderr.trim())
console.log(stdout.trim())
for (const ext of ['vtt', 'jpg']) fs.copyFileSync(path.join(recorded, 'ar', `${slug}.${ext}`), path.join(out, `${slug}.${ext}`))
// check: both streams, the recording's length, the narration audible
const { stdout: probe } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name:format=duration', '-of', 'json', target])
const j = JSON.parse(probe)
const kinds = j.streams.map(s => s.codec_type)
const dur = Number(j.format.duration)
if (!kinds.includes('video') || !kinds.includes('audio')) throw new Error(`${target}: streams ${kinds.join(', ')}`)
if (Math.abs(dur - entry.durationSeconds) > 0.6) throw new Error(`${target}: ${dur.toFixed(2)} s, the recording is ${entry.durationSeconds} s`)
const { stderr: vol } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', target, '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'], { maxBuffer: 16 << 20 })
const mean = Number((/mean_volume: (-?[\d.]+) dB/.exec(vol) || [])[1])
if (!(mean > -40)) throw new Error(`${target}: the narration is not audible (mean ${mean} dB)`)
console.log(`OK ${path.relative(WORK, target)}: ${dur.toFixed(1)} s, video + audio, ${entry.scenes.length} scene clips, mean ${mean} dB`)
if (out === path.join(WORK, 'final')) {
  const rows = readManifest()
  const row = rows.find(r => r.lesson.endsWith(`-${slug}`) && r.section === 's1')
  if (row) { row.start_sec = String(entry.scenes[0].start); row.status = 'final'; writeManifest(rows) }
}
