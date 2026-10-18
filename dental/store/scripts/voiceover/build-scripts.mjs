// Writes the Gemini voice-over scripts of the Arabic course (store/voiceover/, see README.md there) from the spoken
// versions of the chapters' narration: one section per chapter (one TTS request of 3–5 minutes), the scenes in order,
// separated by <long pause> (the splitter cuts the speech back into scenes at those pauses).
//   node store/scripts/voiceover/build-scripts.mjs <spoken.json>
// spoken.json: [{ lesson: "L01", slug, scenes: [{ id, spoken }] }]. The original text of each scene (the captions) is
// read from store/scripts/video/chapters/<slug>.mjs; every scene must be there, in the same order.
// Prints, per chapter, each word-level difference between the spoken text (diacritics removed) and the original, to
// review: only numbers, English terms, symbols and added commas may differ.
// Writes scripts/<lesson>-<slug>_s1.txt (what the voice reads), scripts/<lesson>-<slug>_s1.json (scenes: id, text,
// spoken) and adds missing rows to manifest.csv (never changes a row that exists).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '../../..')
const WORK = path.join(APP, 'store/voiceover')
const CHAPTERS = path.join(APP, 'store/scripts/video/chapters')
export const SEPARATOR = '\n<long pause>\n'
export const MANIFEST_COLUMNS = ['lesson', 'section', 'script', 'wav', 'start_sec', 'status']

const DIACRITICS = /[ً-ْٰـ]/g
const words = s => s.replace(DIACRITICS, '').replace(/[«»"'.,،:;؛!?؟…()\-—←]/g, ' ').split(/\s+/).filter(Boolean)

/** Word-level differences between a and b (LCS), as ["a words" -> "b words"] pairs. */
function diff(a, b) {
  const n = a.length, m = b.length
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out = []
  let i = 0, j = 0, da = [], db = []
  const flush = () => { if (da.length || db.length) out.push(`${da.join(' ') || '∅'} → ${db.join(' ') || '∅'}`); da = []; db = [] }
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++ }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) db.push(b[j++])
    else da.push(a[i++])
  }
  flush()
  return out
}

export function readManifest(file = path.join(WORK, 'manifest.csv')) {
  if (!fs.existsSync(file)) return []
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split('\n')
  const cols = head.split(',')
  return lines.filter(Boolean).map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])))
}
export function writeManifest(rows, file = path.join(WORK, 'manifest.csv')) {
  const body = rows.map(r => MANIFEST_COLUMNS.map(c => String(r[c] ?? '').replace(/,/g, ' ')).join(','))
  fs.writeFileSync(file, [MANIFEST_COLUMNS.join(','), ...body].join('\n') + '\n')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const spoken = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  fs.mkdirSync(path.join(WORK, 'scripts'), { recursive: true })
  const rows = readManifest()
  let problems = 0
  for (const ch of spoken) {
    const { chapter } = await import(pathToFileURL(path.join(CHAPTERS, `${ch.slug}.mjs`)).href)
    const ids = chapter.scenes.map(s => s.id), got = ch.scenes.map(s => s.id)
    if (ids.join() !== got.join()) { console.error(`${ch.slug}: scenes differ from the chapter script (${got.join()} vs ${ids.join()})`); problems++; continue }
    const scenes = chapter.scenes.map((s, i) => ({ id: s.id, text: s.say.ar.replace(/\s+/g, ' ').trim(), spoken: ch.scenes[i].spoken.replace(/\s+/g, ' ').trim() }))
    for (const s of scenes) {
      if (/[A-Za-z0-9٠-٩<>\[\]{}←→]/.test(s.spoken)) { console.error(`${ch.slug}/${s.id}: Latin letters, digits or symbols left: ${s.spoken}`); problems++ }
    }
    const base = `${ch.lesson}-${ch.slug}_s1`
    fs.writeFileSync(path.join(WORK, 'scripts', `${base}.txt`), scenes.map(s => s.spoken).join(SEPARATOR) + '\n')
    fs.writeFileSync(path.join(WORK, 'scripts', `${base}.json`), JSON.stringify({ lesson: ch.lesson, slug: ch.slug, section: 's1', scenes }, null, 2) + '\n')
    const d = scenes.flatMap(s => diff(words(s.text), words(s.spoken)).map(x => `  ${s.id}: ${x}`))
    console.log(`${base}: ${scenes.length} scenes, ${words(scenes.map(s => s.spoken).join(' ')).length} spoken words, ${d.length} differences`)
    for (const line of d) console.log(line)
    if (!rows.some(r => r.lesson === `${ch.lesson}-${ch.slug}` && r.section === 's1')) {
      rows.push({ lesson: `${ch.lesson}-${ch.slug}`, section: 's1', script: `scripts/${base}.txt`, wav: `audio/${base}.wav`, start_sec: '', status: 'script' })
    }
  }
  rows.sort((a, b) => (a.lesson + a.section).localeCompare(b.lesson + b.section))
  writeManifest(rows)
  if (problems) { console.error(`${problems} problem(s)`); process.exit(1) }
}
