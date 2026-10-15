// The narration: Microsoft neural voices through edge-tts (python3 -m edge_tts), one MP3 per scene, with the
// synthesiser's sentence boundaries (SRT) for the captions and the duration measured by ffprobe. Cached in
// $VIDEO_WORK/tts/<sha256 of voice+text>.{mp3,srt,json}, so re-recording a chapter re-synthesises only what changed.
// When the voice service is unreachable the error says so and the recorder stops: no silent fallback to a worse voice.
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** The voices of the contract (docs/VIDEOS.md), overridable per language. */
export const VOICES = {
  ar: process.env.VIDEO_VOICE_AR || 'ar-SY-AmanyNeural',
  en: process.env.VIDEO_VOICE_EN || 'en-US-AndrewMultilingualNeural',
}
/** Speaking rate per language ('-5%' slows a voice that sounds rushed; measured as words per second in the log). */
export const RATES = {
  ar: process.env.VIDEO_RATE_AR || '+0%',
  en: process.env.VIDEO_RATE_EN || '+0%',
}

export class TtsError extends Error {}

/** `python3 -m edge_tts --version`, or a TtsError telling how to install it. */
export async function checkTts() {
  try {
    const { stdout } = await run('python3', ['-m', 'edge_tts', '--version'])
    return stdout.trim()
  } catch (e) {
    throw new TtsError(`edge-tts is not installed (python3 -m edge_tts failed: ${firstLine(e.stderr || e.message)}). Install it with: pip install edge-tts`)
  }
}

/** The duration of an audio file in seconds (ffprobe). */
export async function audioDuration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  const d = Number(stdout.trim())
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe found no duration in ${file}`)
  return d
}

/** "00:00:03,575" (SRT) or "00:00:03.575" (VTT) → seconds. */
export function parseTimecode(s) {
  const m = /^(\d+):(\d\d):(\d\d)[,.](\d{1,3})$/.exec(s.trim())
  if (!m) throw new Error(`bad timecode ${s}`)
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000
}

/** The cues of an SRT file: [{ start, end, text }] in seconds, in file order. */
export function parseSrt(srt) {
  const cues = []
  for (const block of srt.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(l => l.trim())
    const at = lines.findIndex(l => l.includes('-->'))
    if (at < 0) continue
    const [a, b] = lines[at].split('-->')
    const text = lines.slice(at + 1).join(' ').replace(/\s+/g, ' ').trim()
    if (text) cues.push({ start: parseTimecode(a), end: parseTimecode(b), text })
  }
  return cues
}

const firstLine = s => String(s || '').trim().split('\n').filter(Boolean).pop() || ''
/** Words of a narration, for the words-per-second measure (punctuation is not a word). */
export const wordCount = text => text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length

/**
 * Synthesises `text` in `lang` (or returns the cached result): { file, duration, cues, cached }.
 * `cues` are the sentence boundaries relative to the clip's start. Throws TtsError when the service fails.
 */
export async function synthesize(text, lang, { work }) {
  const voice = VOICES[lang], rate = RATES[lang]
  if (!voice) throw new TtsError(`no voice for language ${lang}`)
  const dir = path.join(work, 'tts')
  fs.mkdirSync(dir, { recursive: true })
  // the cache key is the voice and the text; a non-default rate is part of the voice
  const key = createHash('sha256').update(`${voice}${rate === '+0%' ? '' : `@${rate}`}\n${text}`).digest('hex')
  const base = path.join(dir, key)
  const meta = `${base}.json`, mp3 = `${base}.mp3`, srt = `${base}.srt`
  if (fs.existsSync(meta) && fs.existsSync(mp3)) {
    const m = JSON.parse(fs.readFileSync(meta, 'utf8'))
    return { file: mp3, duration: m.duration, cues: m.cues, cached: true }
  }
  // written under temporary names and renamed at the end: a failed run never leaves a half cache entry
  const tmpMp3 = `${base}.tmp.mp3`, tmpSrt = `${base}.tmp.srt`, textFile = `${base}.txt`
  fs.writeFileSync(textFile, text)
  const clean = () => { for (const f of [tmpMp3, tmpSrt, textFile]) fs.rmSync(f, { force: true }) }
  try {
    await run('python3', ['-m', 'edge_tts', '--no-progress', '-v', voice, '--rate', rate, '-f', textFile, '--write-media', tmpMp3, '--write-subtitles', tmpSrt], { timeout: 120000 })
  } catch (e) {
    clean()
    throw new TtsError(`edge-tts could not synthesise with ${voice}: ${firstLine(e.stderr) || e.message}. Either the voice name is wrong or the Microsoft voice service is unreachable (network, proxy): the recorder stops here, there is no fallback voice.`)
  }
  if (!fs.existsSync(tmpMp3) || fs.statSync(tmpMp3).size < 1000) {
    clean()
    throw new TtsError(`edge-tts produced no audio for "${text.slice(0, 40)}…" with ${voice}: the voice service answered nothing; the recorder stops here.`)
  }
  const duration = await audioDuration(tmpMp3)
  let cues = fs.existsSync(tmpSrt) ? parseSrt(fs.readFileSync(tmpSrt, 'utf8')) : []
  if (!cues.length) cues = [{ start: 0, end: duration, text }]       // no boundaries: one cue for the clip
  fs.renameSync(tmpMp3, mp3)
  if (fs.existsSync(tmpSrt)) fs.renameSync(tmpSrt, srt)
  fs.writeFileSync(meta, JSON.stringify({ voice, rate, text, duration, cues }, null, 2) + '\n')
  fs.rmSync(textFile, { force: true })
  return { file: mp3, duration, cues, cached: false }
}

/**
 * Synthesises every text of `items` ([{ text, lang }]) a few at a time (the service is slow per call, not per byte)
 * and returns the results in the same order. The first failure stops the batch.
 */
export async function synthesizeAll(items, { work, concurrency = 3 } = {}) {
  const results = new Array(items.length)
  let next = 0, failed = null
  const worker = async () => {
    while (next < items.length && !failed) {
      const i = next++
      try { results[i] = await synthesize(items[i].text, items[i].lang, { work }) } catch (e) { failed = failed || e }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  if (failed) throw failed
  return results
}
