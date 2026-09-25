// Collects every English string the app can speak, grouped per unit, into audio-src/<book>/texts.json
//   node scripts/export-audio-texts.mjs [book]   (default g8)
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const BOOK = process.argv[2] || 'g8'
const tmp = path.resolve(`node_modules/.cache/emar-data-${BOOK}.mjs`)
const tmpText = path.resolve('node_modules/.cache/emar-text.mjs')
fs.mkdirSync(path.dirname(tmp), { recursive: true })
await build({ entryPoints: [`src/books/${BOOK}/index.ts`], bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error' })
await build({ entryPoints: ['src/engine/text.ts'], bundle: true, format: 'esm', platform: 'node', outfile: tmpText, logLevel: 'error' })
const { modules } = await import(pathToFileURL(tmp).href)
const { splitSentences } = await import(pathToFileURL(tmpText).href)

export const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase()
const groups = {}
const add = (g, t) => { if (!t || !t.trim()) return; (groups[g] ||= new Map()).set(norm(t), t.trim()) }

// The app reads out a completed gap sentence, a true/false statement and a built sentence, and after a
// wrong answer it says the right option. Multiple-choice prompts and wrong options are never spoken.
function addDrills(g, list) {
  for (const e of list) {
    if (e.type === 'fill') { add(g, e.prompt.replace('___', e.options[e.answer])); add(g, e.options[e.answer]) }
    else if (e.type === 'build' || e.type === 'order') add(g, e.answer)
    else if (e.type === 'truefalse') add(g, e.prompt)
    else if (e.type === 'mcq') add(g, e.options[e.answer])
  }
}
const addQuestions = (g, r) => { r.questions.forEach(q => add(g, q.options[q.answer])); (r.trueFalse || []).forEach(t => add(g, t.statement)) }

for (const m of modules) {
  for (const u of m.units) {
    const g = u.id
    for (const w of u.vocab) { add(g, w.en); add(g, w.example) }
    u.sentences.forEach(s => add(g, s))
    u.grammar.examples.forEach(s => add(g, s))
    addDrills(g, u.grammar.exercises)
    // one clip per sentence so the reader can highlight where it is
    for (const p of u.reading.paragraphs) for (const sen of splitSentences(p)) add(g, sen)
    addQuestions(g, u.reading)
    u.pronunciation?.groups.forEach(gr => gr.words.forEach(w => add(g, w)))
    ;(u.vocabFocus?.examples || []).forEach(s => add(g, s))
    addDrills(g, [...(u.vocabFocus?.exercises || []), ...(u.everyday?.exercises || [])])
    for (const x of u.everyday?.expressions || []) add(g, x.en)
    for (const d of u.everyday?.dialogue || []) add(g, d.en)
    for (const r of u.extraReadings || []) {
      for (const p of r.paragraphs) for (const sen of splitSentences(p)) add(g, sen)
      addQuestions(g, r)
    }
    ;(u.writing?.model || []).forEach(p => add(g, p))
    // Activity Book texts and exercises, translation sentences, composition language and models
    for (const r of u.workbook?.readings || []) {
      for (const p of r.paragraphs) for (const sen of splitSentences(p)) add(g, sen)
      addQuestions(g, r)
    }
    addDrills(g, u.workbook?.exercises || [])
    for (const t of u.translations || []) add(g, t.en)
    for (const c of u.compositions || []) {
      c.phrases.forEach(p => add(g, p.en))
      for (const sen of splitSentences(c.model)) add(g, sen)
    }
  }
  const g = `m${m.number}`
  if (m.progressTest) {
    addDrills(g, m.progressTest.exercises)
    for (const p of m.progressTest.reading?.paragraphs || []) for (const sen of splitSentences(p)) add(g, sen)
    if (m.progressTest.reading) addQuestions(g, m.progressTest.reading)
  }
  if (m.review) {
    addDrills(g, m.review.exercises)
    for (const p of m.review.reading?.paragraphs || []) for (const sen of splitSentences(p)) add(g, sen)
    if (m.review.reading) addQuestions(g, m.review.reading)
  }
  m.focus?.glossary?.forEach(w => add(g, w.en))
  for (const p of m.focus?.paragraphs || []) for (const sen of splitSentences(p)) add(g, sen)
}
const out = {}
let n = 0, chars = 0
for (const [g, map] of Object.entries(groups)) { out[g] = [...map.values()]; n += map.size; chars += [...map.values()].join('').length }
fs.mkdirSync(`audio-src/${BOOK}`, { recursive: true })
fs.writeFileSync(`audio-src/${BOOK}/texts.json`, JSON.stringify(out, null, 1))
console.log('groups', Object.keys(out).length, 'texts', n, 'chars', chars)
for (const [g, l] of Object.entries(out)) console.log(g, l.length, l.join('').length)
