// The narration: Microsoft neural voices through edge-tts (python3 -m edge_tts), one MP3 per scene, with the
// synthesiser's sentence boundaries (SRT) timing the captions, whose text is the narration's own sentences, and the
// duration measured by ffprobe. Cached in $VIDEO_WORK/tts/<sha256 of voice+text>.{mp3,srt,json}, so re-recording a
// chapter re-synthesises only what changed.
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

/** The cues of an SRT file on disk, none when there is no file. */
const readSrt = file => (fs.existsSync(file) ? parseSrt(fs.readFileSync(file, 'utf8')) : [])

/** A dot after one of these is an abbreviation, not the end of a sentence. */
const ABBREVIATION = /(?:^|[\s(«"'])(?:[A-Za-z]|e\.g|i\.e|vs|Dr|Mr|Mrs|Ms)\.$/

/**
 * The sentences of a narration, for the captions (one cue per sentence). A sentence ends after a run of sentence
 * punctuation (. ! ? ؟ …) followed by a space or the end of the text. A mark right before a closing quote belongs
 * to the quoted label (the app's labels are quoted «so»: «نسيت رمز الدخول؟» لترى…, «عملة أخرى…» واكتب…), so the
 * sentence goes on; a comma after a mark continues it too (?, and ؟،). Colons, semicolons and commas (، too) never
 * end a sentence, nor does a dot inside a number or a word or after an abbreviation (Dr., e.g., a single letter).
 * Every character of `text` is kept, in order: the sentences joined with one space give the whitespace-normalised
 * text back.
 */
export function splitSentences(text) {
  const t = text.replace(/\s+/g, ' ').trim()
  const pieces = []
  let from = 0
  for (const m of t.matchAll(/[.!?؟…]+(?=\s|$)/g)) {
    const to = m.index + m[0].length
    const piece = t.slice(from, to).trim()
    if (ABBREVIATION.test(piece)) continue           // "Dr. Laila", "e.g. a lab": the sentence goes on
    pieces.push(piece)
    from = to
  }
  if (from < t.length) pieces.push(t.slice(from).trim())
  const sentences = []
  for (const p of pieces) {
    if (!p) continue
    // a piece without a letter or digit (a stray mark) belongs to the sentence before it
    if (sentences.length && !/[\p{L}\p{N}]/u.test(p)) sentences[sentences.length - 1] += ` ${p}`
    else sentences.push(p)
  }
  return sentences
}

const round3 = n => Math.round(n * 1000) / 1000

/**
 * The caption cues of a narration ([{ start, end, text }], seconds from the clip's start): the synthesiser's sentence
 * boundaries (`srtCues`, from edge-tts's SRT) give the timings, the text's own sentences (splitSentences) give the
 * words. The SRT's text is never used: edge-tts builds it from word boundaries, which drop punctuation that is not
 * attached to a spoken word, so a sentence starting with «الرئيسية» came back as الرئيسية», and an ellipsis inside a
 * quoted label («عملة أخرى…») ended the cue before its closing ». Sentence i takes the timing of cue i. When the
 * counts differ (the synthesiser cut elsewhere, or there is no SRT) the sentences share the time in proportion to
 * their length in characters: within each SRT cue, whose share of the characters is its share of the text, so a
 * boundary both cut at keeps its measured time; over the whole clip when there is no SRT.
 */
export function captionCues(text, srtCues, duration) {
  const sentences = splitSentences(text)
  if (!sentences.length) return [{ start: 0, end: duration, text }]
  if (srtCues.length === sentences.length) return sentences.map((s, i) => ({ start: srtCues[i].start, end: srtCues[i].end, text: s }))
  // share of the characters → time: a polyline through the SRT's boundaries (or the clip's two ends)
  const clock = [{ at: 0, t: srtCues.length ? srtCues[0].start : 0 }]
  const chars = srtCues.reduce((n, c) => n + c.text.length, 0)
  let seen = 0
  for (const c of srtCues) { seen += c.text.length; clock.push({ at: seen / chars, t: c.end }) }
  if (!srtCues.length) clock.push({ at: 1, t: duration })
  const timeAt = at => {
    let i = clock.findIndex((p, i) => i > 0 && at <= p.at)
    if (i < 0) i = clock.length - 1
    const a = clock[i - 1], b = clock[i]
    return round3(a.t + (b.t - a.t) * (at - a.at) / ((b.at - a.at) || 1))
  }
  const total = sentences.reduce((n, s) => n + s.length, 0)
  seen = 0
  return sentences.map(s => {
    const start = timeAt(seen / total)
    seen += s.length
    return { start, end: timeAt(seen / total), text: s }
  })
}

const firstLine = s => String(s || '').trim().split('\n').filter(Boolean).pop() || ''
/** Words of a narration, for the words-per-second measure (punctuation is not a word). */
export const wordCount = text => text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length

/**
 * Synthesises `text` in `lang` (or returns the cached result): { file, duration, cues, cached }.
 * `cues` are the caption cues (captionCues) relative to the clip's start. Throws TtsError when the service fails.
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
    // the cues are rebuilt from the cached SRT every time: an entry cached before a change of the caption rules follows them too
    return { file: mp3, duration: m.duration, cues: captionCues(text, readSrt(srt), m.duration), cached: true }
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
  const cues = captionCues(text, readSrt(tmpSrt), duration)
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
