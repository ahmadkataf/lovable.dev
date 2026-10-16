// Cuts one chapter's Gemini narration (audio/<base>.wav, one TTS request: the scenes separated by <long pause>) back
// into one clip per scene, for the recorder (store/scripts/video/make.mjs with VIDEO_NARRATION_DIR), so every scene of
// the re-recorded video lasts as long as its own narration and the picture follows the words. Nothing is sped up,
// slowed down or stretched: a clip is the speech between two pauses, as spoken.
//   node store/scripts/voiceover/split.mjs <lesson-slug_s1> [--force]
// Reads scripts/<base>.json (scenes: id, text = the caption, spoken = what was read) and audio/<base>.wav; writes
// narration/ar/<slug>/<scene-id>.wav (24 kHz mono, as generated) and <scene-id>.json ({ duration, cues: [{ start, end,
// text }] }: one caption cue per sentence of the original text, timed at the pauses between the spoken sentences),
// and narration/ar/<slug>/report.json. Exit 1 when the cuts are doubtful (a scene far slower or faster than the rest):
// listen to the flagged scenes before recording.
// How the cuts are chosen: ffmpeg's silencedetect lists the pauses. Local speech recognition (asr_align.py, run with
// the Python of ASR_PYTHON, a venv with faster-whisper) anchors the script's words in time: each boundary between two
// scenes is cut at the longest pause between the last word of one and the first word of the next, and each caption
// starts at its sentence's first word. Where the recognition anchors nothing, dynamic programming picks the cut among
// the pauses so that every scene's length follows its share of the text (letters spoken, at the chapter's own rate)
// while preferring long pauses (the <long pause> between scenes); the report counts how many cuts each method made and
// where they disagree. Without ASR_PYTHON only the second method runs, and every chapter is reported doubtful.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { splitSentences } from '../video/lib/tts.mjs'

const run = promisify(execFile)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '../../..')
const WORK = path.join(APP, 'store/voiceover')
const r3 = n => Math.round(n * 1000) / 1000

/** Letters actually spoken (no diacritics, punctuation or spaces): the measure of a text's length in time. */
export const letters = s => s.replace(/[ً-ْٰـ]/g, '').replace(/[^\p{L}\p{N}]/gu, '').length

/** Pauses of a WAV: [{ start, end }] in seconds, and the file's duration. */
export async function silences(file, { noise = -38, min = 0.12 } = {}) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `silencedetect=noise=${noise}dB:d=${min}`, '-f', 'null', '-'], { maxBuffer: 64 << 20 })
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  const duration = Number(stdout.trim())
  const out = []
  let open = null
  for (const line of stderr.split('\n')) {
    let m
    if ((m = /silence_start: (-?[\d.]+)/.exec(line))) open = Math.max(0, Number(m[1]))
    else if ((m = /silence_end: ([\d.]+)/.exec(line)) && open !== null) { out.push({ start: open, end: Number(m[1]) }); open = null }
  }
  if (open !== null) out.push({ start: open, end: duration })
  return { list: out, duration }
}

/**
 * Picks k-1 cuts among `gaps` (pauses inside [from, to], in order) so that the k segments' lengths follow `weights`.
 * Returns the chosen gaps (in order) or null when there are fewer gaps than cuts.
 */
export function chooseCuts(gaps, weights, from, to, { pauseBonus = 1.2, allowed = [] } = {}) {
  const k = weights.length
  if (k === 1) return []
  if (gaps.length < k - 1) return null
  const W = weights.reduce((a, b) => a + b, 0)
  // the rate of speech: the span without the k-1 longest pauses (the expected cuts); pauses inside segments stay in
  const longest = gaps.map(g => g.end - g.start).sort((a, b) => b - a).slice(0, k - 1).reduce((a, b) => a + b, 0)
  const rate = (to - from - longest) / W
  const segCost = (dur, w) => { const e = rate * w; const d = (dur - e) / (0.22 * e + 0.6); return d * d }
  const M = gaps.length
  // best[i][j]: best score with cut i (0-based, after segment i) at gap j
  const best = Array.from({ length: k - 1 }, () => new Float64Array(M).fill(-Infinity))
  const prev = Array.from({ length: k - 1 }, () => new Int32Array(M).fill(-1))
  const bonus = g => pauseBonus * Math.log(Math.max(0.05, g.end - g.start) / 0.05)
  const ok = (i, j) => !allowed[i] || allowed[i].includes(j)
  for (let j = 0; j < M; j++) if (ok(0, j)) best[0][j] = -segCost(gaps[j].start - from, weights[0]) + bonus(gaps[j])
  for (let i = 1; i < k - 1; i++) {
    for (let j = i; j < M; j++) {
      if (!ok(i, j)) continue
      for (let p = i - 1; p < j; p++) {
        if (best[i - 1][p] === -Infinity) continue
        const s = best[i - 1][p] - segCost(gaps[j].start - gaps[p].end, weights[i]) + bonus(gaps[j])
        if (s > best[i][j]) { best[i][j] = s; prev[i][j] = p }
      }
    }
  }
  let bj = -1, bs = -Infinity
  for (let j = k - 2; j < M; j++) {
    if (best[k - 2][j] === -Infinity) continue
    const s = best[k - 2][j] - segCost(to - gaps[j].end, weights[k - 1])
    if (s > bs) { bs = s; bj = j }
  }
  if (bj < 0) return null
  const picked = []
  for (let i = k - 2, j = bj; i >= 0; j = prev[i][j], i--) picked.unshift(gaps[j])
  return picked
}

async function cut(src, from, to, out) {
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-ss', from.toFixed(3), '-to', to.toFixed(3), '-c:a', 'pcm_s16le', out])
}

/** The speech recognition anchors of a chapter (asr_align.py), cached in <dir>/asr.json; null without ASR_PYTHON. */
async function recognise(wav, script, dir) {
  const py = process.env.ASR_PYTHON
  if (!py) return null
  const out = path.join(dir, 'asr.json')
  if (!fs.existsSync(out)) {
    const job = { wav, sentences: script.scenes.flatMap((s, i) => splitSentences(s.spoken).map((t, k) => ({ scene: i, sentence: k, words: t.split(/\s+/).filter(Boolean) }))) }
    const inp = path.join(dir, 'asr-in.json')
    fs.writeFileSync(inp, JSON.stringify(job))
    const { stdout } = await run(py, [path.join(HERE, 'asr_align.py'), inp, out], { maxBuffer: 64 << 20, timeout: 3600000 })
    process.stdout.write(stdout)
  }
  return JSON.parse(fs.readFileSync(out, 'utf8'))
}

export async function splitChapter(base, { force = false } = {}) {
  const script = JSON.parse(fs.readFileSync(path.join(WORK, 'scripts', `${base}.json`), 'utf8'))
  const wav = path.join(WORK, 'audio', `${base}.wav`)
  if (!fs.existsSync(wav)) throw new Error(`${path.relative(APP, wav)} does not exist yet`)
  const dir = path.join(WORK, 'narration', 'ar', script.slug)
  if (fs.existsSync(path.join(dir, 'report.json')) && !force) return JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'))
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (!f.startsWith('asr')) fs.rmSync(path.join(dir, f), { force: true })
  fs.mkdirSync(dir, { recursive: true })
  const { list, duration } = await silences(wav)
  // the speech: from the end of a leading pause to the start of a trailing one
  const from = list.length && list[0].start <= 0.01 ? list[0].end : 0
  const to = list.length && list[list.length - 1].end >= duration - 0.01 ? list[list.length - 1].start : duration
  const inner = list.filter(g => g.start > from + 0.05 && g.end < to - 0.05)
  const weights = script.scenes.map(s => letters(s.spoken))
  const asr = await recognise(wav, script, dir)
  // the boundaries the recognition anchors: the longest pause between the last word of a scene and the first of the next
  const sceneSpan = i => {
    const sp = asr ? asr.sentences.filter(x => x.scene === i && x.first !== null) : []
    return sp.length ? { first: Math.min(...sp.map(x => x.first)), last: Math.max(...sp.map(x => x.last)) } : null
  }
  const allowed = script.scenes.slice(0, -1).map((_, i) => {
    const a = sceneSpan(i), b = sceneSpan(i + 1)
    if (!a || !b) return null
    const lo = Math.min(a.last, b.first) - 0.35, hi = Math.max(a.last, b.first) + 0.35
    const cand = inner.map((g, j) => ({ g, j })).filter(({ g }) => g.end > lo && g.start < hi)
    if (!cand.length) return null
    return [cand.reduce((x, y) => (y.g.end - y.g.start > x.g.end - x.g.start ? y : x)).j]
  })
  const byPauses = chooseCuts(inner, weights, from, to)
  let cuts = chooseCuts(inner, weights, from, to, { allowed })
  if (!cuts) cuts = byPauses   // the anchors contradict each other (out of order): pauses only, flagged below
  if (!cuts) throw new Error(`${base}: only ${inner.length} pauses for ${script.scenes.length} scenes`)
  const bounds = script.scenes.map((_, i) => ({ start: i ? cuts[i - 1].end : from, end: i < cuts.length ? cuts[i].start : to }))
  // the chapter's pace: the scenes' speech (without the pauses between scenes) per letter
  const rate = bounds.reduce((n, b) => n + b.end - b.start, 0) / weights.reduce((a, b) => a + b, 0)
  const report = { base, slug: script.slug, duration: r3(duration), speech: [r3(from), r3(to)], rate: r3(rate), scenes: [] }
  for (const [i, s] of script.scenes.entries()) {
    const b = bounds[i]
    // a little air around the words, never into the neighbouring scene's speech
    const a = Math.max(i ? cuts[i - 1].start : 0, b.start - 0.06), z = Math.min(i < cuts.length ? cuts[i].end : duration, b.end + 0.2)
    const clip = path.join(dir, `${s.id}.wav`)
    await cut(wav, a, z, clip)
    // the sentences: the original's (captions) and the spoken text's (timing) correspond one to one
    const shown = splitSentences(s.text), said = splitSentences(s.spoken)
    const pairs = shown.length === said.length ? said.map(letters) : [letters(s.spoken)]
    const gaps = list.filter(g => g.start > b.start + 0.05 && g.end < b.end - 0.05 && g.end - g.start >= 0.15)
    // sentence boundaries: at the recognised words when anchored (the pause between them, else their midpoint)
    const sent = asr ? asr.sentences.filter(x => x.scene === i) : []
    let marks = null
    if (shown.length === said.length && sent.length === said.length && said.length > 1 && sent.every(x => x.first !== null)) {
      marks = sent.slice(0, -1).map((x, k) => {
        const lo = Math.min(x.last, sent[k + 1].first), hi = Math.max(x.last, sent[k + 1].first)
        const g = gaps.filter(g => g.end > lo - 0.25 && g.start < hi + 0.25).sort((p, q) => (q.end - q.start) - (p.end - p.start))[0]
        return g || { start: (lo + hi) / 2, end: (lo + hi) / 2 }
      })
      if (marks.some((m, k) => m.start < b.start || m.end > b.end || (k && m.start < marks[k - 1].end))) marks = null
    }
    if (!marks) marks = pairs.length > 1 ? chooseCuts(gaps, pairs, b.start, b.end, { pauseBonus: 0.8 }) : []
    let cues
    if (shown.length === said.length && marks) {
      cues = shown.map((text, k) => ({ start: r3((k ? marks[k - 1].end : b.start) - a), end: r3((k < marks.length ? marks[k].start : b.end) - a), text }))
    } else {
      // no pause to time the sentences: share the scene's speech in proportion to the letters
      const w = shown.map(letters), W = w.reduce((x, y) => x + y, 0)
      let t = b.start - a
      cues = shown.map((text, k) => { const d = (b.end - b.start) * w[k] / W; const c = { start: r3(t), end: r3(t + d), text }; t += d; return c })
    }
    const dur = r3(z - a)
    fs.writeFileSync(path.join(dir, `${s.id}.json`), JSON.stringify({ duration: dur, cues }, null, 2) + '\n')
    report.scenes.push({ id: s.id, start: r3(b.start), end: r3(b.end), clip: dur, letters: weights[i], pace: r3((b.end - b.start) / (weights[i] * rate)), cutPause: i < cuts.length ? r3(cuts[i].end - cuts[i].start) : null, sentences: shown.length, timedAtPauses: shown.length === said.length && !!marks })
  }
  // doubtful: a scene's pace far from the chapter's (a cut in the wrong pause makes one scene too long and the next too short)
  report.asr = asr ? { anchored: asr.sentences.filter(x => x.first !== null).length, sentences: asr.sentences.length, words: asr.sentences.reduce((n, x) => n + x.matched, 0), of: asr.sentences.reduce((n, x) => n + x.total, 0) } : null
  report.cutsByAsr = allowed.filter(Boolean).length
  report.disagree = byPauses ? cuts.map((c, i) => (c === byPauses[i] ? null : script.scenes[i + 1].id)).filter(Boolean) : []
  // doubtful: no recognition; a boundary the recognition could not anchor; a scene's pace far from the chapter's
  report.flagged = [...new Set([
    ...(asr ? [] : ['(no speech recognition: every cut is from the pauses alone)']),
    ...allowed.map((x, i) => (x ? null : script.scenes[i + 1].id)).filter(Boolean),
    ...report.scenes.filter(s => s.pace < 0.6 || s.pace > 1.6).map(s => s.id),
  ])]
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[2]
  const report = await splitChapter(base, { force: process.argv.includes('--force') })
  const paces = report.scenes.map(s => s.pace)
  console.log(`${base}: ${report.scenes.length} scenes, speech ${report.speech[0]}–${report.speech[1]} s of ${report.duration} s, pace ${Math.min(...paces).toFixed(2)}–${Math.max(...paces).toFixed(2)}, shortest cut pause ${Math.min(...report.scenes.filter(s => s.cutPause !== null).map(s => s.cutPause)).toFixed(2)} s, ${report.scenes.filter(s => s.timedAtPauses).length}/${report.scenes.length} scenes with sentence timing at pauses`)
  console.log(`  cuts anchored by speech recognition: ${report.cutsByAsr}/${report.scenes.length - 1}${report.asr ? `, words anchored ${report.asr.words}/${report.asr.of}` : ''}${report.disagree.length ? `; the pauses alone would cut elsewhere before: ${report.disagree.join(', ')}` : ''}`)
  if (report.flagged.length) { console.log(`doubtful scenes: ${report.flagged.join(', ')}`); process.exit(1) }
}
