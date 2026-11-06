// Puts a finished chapter (final/<slug>.mp4, .vtt, .jpg) in the site's videos (server/site/videos/ar/, git-ignored)
// and its entry in server/site/videos/manifest.json: the size and sha256 of the final file (the pages add the sha to
// the URLs, and the Worker's edge cache keys on it, so viewers get the new file at once), its duration, and the scene
// starts and captions of the recording. `npm run deploy` in server/ then publishes it.
//   node store/scripts/voiceover/publish.mjs <slug>
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '../../..')
const WORK = path.join(APP, 'store/voiceover')
const SITE = path.join(APP, 'server/site/videos')
const slug = process.argv[2]
const rec = JSON.parse(fs.readFileSync(path.join(WORK, 'recorded/manifest.json'), 'utf8'))[`ar/${slug}`]
if (!rec) throw new Error(`no ar/${slug} in recorded/manifest.json`)
const src = ext => path.join(WORK, 'final', `${slug}.${ext}`)
for (const ext of ['mp4', 'vtt', 'jpg']) if (!fs.existsSync(src(ext))) throw new Error(`missing ${src(ext)}`)
const bytes = fs.readFileSync(src('mp4'))
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', src('mp4')], { encoding: 'utf8' }))
const v = probe.streams.find(s => s.codec_type === 'video')
if (!v || !probe.streams.some(s => s.codec_type === 'audio')) throw new Error('the final file needs a video and an audio stream')
const entry = {
  durationSeconds: Math.round(Number(probe.format.duration) * 1000) / 1000, sizeBytes: bytes.length, width: v.width, height: v.height,
  sha256: createHash('sha256').update(bytes).digest('hex'), scenes: rec.scenes, recordedAt: new Date().toISOString().slice(0, 10),
}
if (bytes.length > 24 * 1024 * 1024) throw new Error(`${src('mp4')} is over 24 MiB`)
fs.mkdirSync(path.join(SITE, 'ar'), { recursive: true })
for (const ext of ['mp4', 'vtt', 'jpg']) fs.copyFileSync(src(ext), path.join(SITE, 'ar', `${slug}.${ext}`))
const file = path.join(SITE, 'manifest.json')
const m = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
m[`ar/${slug}`] = entry
fs.writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b))), null, 1))
console.log(`published locally ar/${slug}: ${entry.durationSeconds} s, ${(bytes.length / 1048576).toFixed(1)} MiB, sha ${entry.sha256.slice(0, 12)}, ${entry.scenes.length} scenes`)
