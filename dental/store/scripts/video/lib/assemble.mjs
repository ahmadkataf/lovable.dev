// Assembles a recorded chapter with ffmpeg: the screencast frames become 30 fps H.264 through the concat demuxer (each
// frame is held until the next one, the last until the end, so an idle screen costs nothing and loses nothing); the
// narration clips are laid at the scene offsets measured while recording (adelay + amix: no drift, however long the
// chapter); AAC mono, faststart. Then the captions (WebVTT from the synthesiser's sentence cues, shifted to the scene
// offsets) and the manifest entry. A file over 24 MiB is re-encoded at a higher crf (the platform serves static files
// up to 25 MiB) with a warning.
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
export const MAX_BYTES = 24 * 1024 * 1024
export const FPS = 30
export const SIZE = { width: 1920, height: 1080 }
/** crf 23 first; each step up roughly halves the size at a visible but acceptable cost on screen recordings. */
const CRF_STEPS = [23, 26, 29, 32]

const ffmpeg = args => run('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', ...args], { maxBuffer: 1 << 24 }).catch(e => {
  throw new Error(`ffmpeg failed: ${String(e.stderr || e.message).trim().split('\n').slice(-3).join(' | ')}`)
})

/**
 * The concat demuxer's list for `frames` ([{ file, ts }], epoch seconds): the video's zero is `t0` (the first frame's
 * timestamp), every frame lasts until the next, the last one until `total`. The frames are put in timestamp order:
 * Chromium encodes the screencast's JPEGs on a thread pool and delivers some of them late (a few per minute arrive
 * 50–120 ms after a newer frame, with their true capture time). The last file is repeated so the demuxer honours
 * its duration.
 */
export function framesList(frames, t0, total) {
  const kept = []
  for (const f of [...frames].sort((a, b) => a.ts - b.ts)) {
    const at = f.ts - t0
    if (at < 0 || at >= total) continue
    if (kept.length && at <= kept[kept.length - 1].at) continue      // the same instant twice
    kept.push({ file: f.file, at })
  }
  if (!kept.length) throw new Error('no frames to assemble')
  const q = p => `'${p.replace(/'/g, "'\\''")}'`
  const lines = ['ffconcat version 1.0']
  kept.forEach((f, i) => {
    const end = i + 1 < kept.length ? kept[i + 1].at : total
    lines.push(`file ${q(f.file)}`, `duration ${Math.max(0.001, end - f.at).toFixed(4)}`)
  })
  lines.push(`file ${q(kept[kept.length - 1].file)}`)
  return { text: lines.join('\n') + '\n', count: kept.length }
}

/** Mixes the narration clips ([{ file, start }], seconds) into one 48 kHz mono WAV of `total` seconds at `out`. */
export async function mixNarration(clips, total, out) {
  const args = ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono']
  const parts = [`[0:a]atrim=duration=${total.toFixed(3)}[base]`]
  clips.forEach((c, i) => {
    args.push('-i', c.file)
    parts.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.round(c.start * 1000)}:all=1[a${i}]`)
  })
  parts.push(`[base]${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length + 1}:duration=first:normalize=0[out]`)
  await ffmpeg([...args, '-filter_complex', parts.join(';'), '-map', '[out]', '-c:a', 'pcm_s16le', '-t', total.toFixed(3), out])
  return out
}

/** Encodes the frames list and the narration WAV into `out` (H.264 yuv420p 30 fps CFR 1920×1080, AAC 96k mono). */
export async function encode({ list, wav, total, out, crf }) {
  await ffmpeg([
    '-f', 'concat', '-safe', '0', '-i', list, '-i', wav,
    '-map', '0:v', '-map', '1:a',
    '-vf', `scale=${SIZE.width}:${SIZE.height}:in_range=full:out_range=limited:flags=lanczos,format=yuv420p`,
    '-fps_mode', 'cfr', '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '1', '-ar', '48000',
    '-movflags', '+faststart', '-t', total.toFixed(3), out,
  ])
  return fs.statSync(out).size
}

/** { duration, width, height, fps, video, audio } of a media file (ffprobe). */
export async function probeVideo(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,channels,sample_rate:format=duration', '-of', 'json', file])
  const j = JSON.parse(stdout)
  const v = j.streams.find(s => s.codec_type === 'video'), a = j.streams.find(s => s.codec_type === 'audio')
  const [n, d] = (v?.r_frame_rate || '0/1').split('/').map(Number)
  return { duration: Number(j.format.duration), width: v?.width, height: v?.height, fps: d ? n / d : 0, video: v?.codec_name, audio: a ? { codec: a.codec_name, channels: a.channels, sampleRate: Number(a.sample_rate) } : null }
}

export const sha256File = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

const tc = s => {
  const ms = Math.round(s * 1000)
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

/**
 * The captions: one cue per sentence of every scene ([{ start, cues: [{ start, end, text }] }]), shifted to the scene's
 * start, in order, never overlapping, never past `total` (the synthesiser's cues may overlap by a few ms).
 */
export function webvtt(scenes, total) {
  const out = ['WEBVTT', '']
  let prevEnd = 0, n = 0
  for (const sc of scenes) {
    for (const c of sc.cues) {
      let start = Math.max(sc.start + c.start, prevEnd)
      let end = Math.min(sc.start + c.end, total)
      if (end - start < 0.3) end = Math.min(start + 0.3, total)
      if (start >= total || end <= start) continue
      out.push(String(++n), `${tc(start)} --> ${tc(end)}`, c.text, '')
      prevEnd = end
    }
  }
  return out.join('\n')
}

/**
 * Assembles one chapter and language: frames + narration → `out.mp4`, captions → `out.vtt`; returns the manifest
 * entry { durationSeconds, sizeBytes, width, height, sha256, scenes: [{ id, start, text }] }. `work` holds the
 * intermediate files (the frames list and the narration WAV).
 */
export async function assemble({ frames, t0, total, scenes, out, work, log = () => {} }) {
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(path.dirname(out.mp4), { recursive: true })
  const list = path.join(work, 'frames.txt')
  const { text, count } = framesList(frames, t0, total)
  fs.writeFileSync(list, text)
  const wav = await mixNarration(scenes.map(s => ({ file: s.file, start: s.start })), total, path.join(work, 'narration.wav'))
  const tmp = path.join(work, 'chapter.mp4')
  let size = 0, crf = CRF_STEPS[0]
  for (const step of CRF_STEPS) {
    crf = step
    size = await encode({ list, wav, total, out: tmp, crf })
    if (size <= MAX_BYTES) break
    const next = CRF_STEPS[CRF_STEPS.indexOf(step) + 1]
    if (next) log(`warning: ${(size / 1048576).toFixed(1)} MiB at crf ${crf} is over ${MAX_BYTES / 1048576} MiB: re-encoding at crf ${next}`)
    else log(`warning: still ${(size / 1048576).toFixed(1)} MiB at crf ${crf}: the chapter is too long for one file, split it`)
  }
  fs.copyFileSync(tmp, out.mp4)
  fs.rmSync(tmp, { force: true })
  fs.writeFileSync(out.vtt, webvtt(scenes, total))
  const probe = await probeVideo(out.mp4)
  if (!probe.audio) throw new Error(`${out.mp4} has no audio track`)
  return {
    entry: { durationSeconds: Math.round(probe.duration * 1000) / 1000, sizeBytes: size, width: probe.width, height: probe.height, sha256: sha256File(out.mp4), scenes: scenes.map(s => ({ id: s.id, start: Math.round(s.start * 1000) / 1000, text: s.text })) },
    crf, frames: count, probe,
  }
}
