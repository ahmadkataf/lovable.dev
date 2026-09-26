// Strict content check for one book (and optionally one module):
//   node scripts/check-book.mjs g11        -> all modules
//   node scripts/check-book.mjs g11 3      -> module 3 only
// Exits non-zero and lists every problem found.
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { bookCorpus, norm } from './book-corpus.mjs'

const [bookId = 'g11', only] = process.argv.slice(2)
const problems = []
// How much each book asks of a unit: the secondary books have big units, Grade 5 has short, simple ones.
const LIMITS = {
  default: { units: 2, vocab: 28, readingWords: 80, readingQ: 6, grammar: 30, vocabFocus: 15, everyday: 8, workbook: 20, workbookReadingQ: 3, modelWords: 80, plan: 3, phrases: 8, translations: 12, sentences: 10, review: 24, progressTest: 20 },
  g5: { units: 5, vocab: 14, readingWords: 30, readingQ: 4, grammar: 18, vocabFocus: 10, everyday: 6, workbook: 12, workbookReadingQ: 2, modelWords: 25, plan: 2, phrases: 5, translations: 6, sentences: 8, review: 20, progressTest: 12 },
}
const L = LIMITS[bookId] || LIMITS.default
const bad = (where, msg) => problems.push(`${where}: ${msg}`)

async function loadModule(n) {
  const src = path.resolve(`src/books/${bookId}/module${n}.ts`)
  if (!fs.existsSync(src)) { bad(`module${n}`, 'file missing'); return null }
  const out = path.resolve(`node_modules/.cache/check-${bookId}-${n}.mjs`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  try {
    await build({ entryPoints: [src], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
  } catch (e) { bad(`module${n}`, `does not compile: ${e.message.split('\n')[0]}`); return null }
  const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`)
  return mod[`module${n}`]
}

const isSentence = s => /[.!?]["')]?$/.test(s.trim()) && s.trim().split(/\s+/).length >= 3

function checkExercises(where, list, min) {
  if (!Array.isArray(list) || list.length < min) bad(where, `needs at least ${min} exercises, has ${list?.length ?? 0}`)
  for (const [i, e] of (list || []).entries()) {
    const w = `${where}[${i}] ${JSON.stringify(e.prompt || e.answer).slice(0, 60)}`
    if (e.type === 'fill' || e.type === 'mcq') {
      if (!Array.isArray(e.options) || e.options.length < 3) bad(w, 'needs 3-4 options')
      else if (new Set(e.options.map(o => o.trim().toLowerCase())).size !== e.options.length) bad(w, 'options repeat')
      if (typeof e.answer !== 'number' || e.answer < 0 || e.answer >= (e.options?.length || 0)) bad(w, 'answer must be an option index')
      if (!e.explainAr?.trim()) bad(w, 'missing explainAr')
      if (!e.promptAr?.trim()) bad(w, 'missing promptAr')
    }
    if (e.type === 'fill') {
      if (!e.prompt?.includes('___')) bad(w, 'fill prompt needs ___')
      if (!e.promptAr?.includes('___')) bad(w, 'promptAr must keep the blank ___')
      if (!e.promptArFull?.trim()) bad(w, 'missing promptArFull')
      else if (e.promptArFull.includes('___')) bad(w, 'promptArFull must not contain ___')
    }
    if (e.type === 'truefalse') {
      if (typeof e.answer !== 'boolean') bad(w, 'truefalse answer must be boolean')
      if (!e.promptAr?.trim()) bad(w, 'missing promptAr')
    }
    if (e.type === 'build' || e.type === 'order') {
      if (typeof e.answer !== 'string' || e.answer.trim().split(/\s+/).length < 3) bad(w, 'build answer must be a sentence')
    }
  }
}

function checkReading(where, r, corpus, minQ) {
  if (!r) { bad(where, 'missing'); return }
  const words = r.paragraphs.join(' ').split(/\s+/).length
  if (words < L.readingWords) bad(where, `text too short (${words} words) — it must be the full book text`)
  for (const p of r.paragraphs) {
    const chunk = norm(p).split(' ').slice(0, 12).join(' ')
    if (!corpus.includes(chunk)) bad(where, `paragraph not found in the book: "${p.slice(0, 70)}"`)
  }
  if (r.paragraphsAr?.length !== r.paragraphs.length) bad(where, 'paragraphsAr must have one translation per paragraph')
  if ((r.questions?.length || 0) < minQ) bad(where, `needs at least ${minQ} questions`)
  for (const q of r.questions || []) {
    if (!q.qAr?.trim()) bad(where, `question without qAr: ${q.q}`)
    if (!(q.answer >= 0 && q.answer < q.options.length)) bad(where, `bad answer index: ${q.q}`)
    if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== q.options.length) bad(where, `repeated options: ${q.q}`)
  }
}

const modCount = fs.readdirSync(`book-source/${bookId}`).filter(f => /^module\d+\.md$/.test(f)).length || 6
const mods = only ? [Number(only)] : Array.from({ length: modCount }, (_, i) => i + 1)
for (const n of mods) {
  const m = await loadModule(n)
  if (!m) continue
  const corpus = bookCorpus(fs.readFileSync(`book-source/${bookId}/module${n}.md`, 'utf8'))
  const wbFile = `book-source/${bookId}/workbook-module${n}.md`
  const wbCorpus = fs.existsSync(wbFile) ? bookCorpus(fs.readFileSync(wbFile, 'utf8')) : ''
  const anyCorpus = corpus + ' ' + wbCorpus
  if (m.number !== n) bad(`module${n}`, 'number mismatch')
  if (m.units?.length !== L.units) bad(`module${n}`, `needs exactly ${L.units} units`)
  for (const u of m.units || []) {
    const W = `module${n}/${u.id}`
    // vocabulary
    if ((u.vocab?.length || 0) < L.vocab) bad(W, `vocab needs at least ${L.vocab} words, has ${u.vocab?.length || 0}`)
    const seen = new Set()
    for (const w of u.vocab || []) {
      const k = w.en?.toLowerCase()
      if (seen.has(k)) bad(W, `duplicate word ${w.en}`); seen.add(k)
      if (!w.ar?.trim() || !w.pos) bad(W, `word ${w.en} needs ar and pos`)
      if (w.def && !w.defAr?.trim()) bad(W, `word ${w.en} needs defAr`)
      if (w.example) {
        if (!w.exampleAr?.trim()) bad(W, `word ${w.en} needs exampleAr`)
        if (!isSentence(w.example)) bad(W, `example of ${w.en} is not a complete sentence: ${w.example}`)
        if (/\([^)]*(\s[-–/]\s|,\s)[^)]*\)/.test(w.example)) bad(W, `example of ${w.en} has an unresolved choice: ${w.example}`)
        if (/^(write|tick|match|complete|choose|fill|underline|circle|listen|discuss)\b/i.test(w.example)) bad(W, `example of ${w.en} is a task instruction: ${w.example}`)
        if (!corpus.includes(norm(w.example))) bad(W, `example of ${w.en} is not in the book: ${w.example}`)
      }
    }
    checkReading(`${W} reading`, u.reading, corpus, L.readingQ)
    for (const [i, r] of (u.extraReadings || []).entries()) checkReading(`${W} extraReadings[${i}]`, r, corpus, 2)
    // grammar
    if (!u.grammar?.ruleAr?.length || !u.grammar?.ruleEn?.length) bad(W, 'grammar needs ruleEn and ruleAr')
    checkExercises(`${W} grammar`, u.grammar?.exercises, L.grammar)
    // taught vocabulary point
    if (u.vocabFocus) {
      if (!u.vocabFocus.ruleAr?.length) bad(W, 'vocabFocus needs ruleAr')
      checkExercises(`${W} vocabFocus`, u.vocabFocus.exercises, L.vocabFocus)
    }
    // everyday english
    if (u.everyday) {
      const e = u.everyday
      if ((e.expressions?.length || 0) < 4) bad(W, 'everyday needs at least 4 expressions')
      for (const x of e.expressions || []) if (!x.ar?.trim()) bad(W, `expression without Arabic: ${x.en}`)
      for (const d of e.dialogue || []) {
        if (!d.ar?.trim()) bad(W, `dialogue line without Arabic: ${d.en}`)
        if (!corpus.includes(norm(d.en).split(' ').slice(0, 8).join(' '))) bad(W, `dialogue line not in the book: ${d.en}`)
      }
      checkExercises(`${W} everyday`, e.exercises, L.everyday)
    }
    // the Activity Book pages of the unit: its texts verbatim, every exercise solved
    if (u.workbook) {
      if (!wbCorpus) bad(W, 'workbook data but no book-source workbook text')
      if (!u.workbook.pages) bad(W, 'workbook needs its pages')
      for (const [i, r] of (u.workbook.readings || []).entries()) checkReading(`${W} workbook.readings[${i}]`, r, wbCorpus, L.workbookReadingQ)
      checkExercises(`${W} workbook`, u.workbook.exercises, L.workbook)
    }
    for (const [i, c] of (u.compositions || []).entries()) {
      const C = `${W} compositions[${i}]`
      if (!c.topic || !c.topicAr) bad(C, 'needs topic and topicAr')
      else if (!anyCorpus.includes(norm(c.topic).split(' ').slice(0, 6).join(' '))) bad(C, `topic is not the book's task: ${c.topic}`)
      if (c.points && c.pointsAr && c.pointsAr.length !== c.points.length) bad(C, 'one pointsAr per point')
      if ((c.plan?.length || 0) < L.plan) bad(C, `plan needs at least ${L.plan} steps`)
      for (const p of c.plan || []) if (!p.en?.trim() || !p.ar?.trim()) bad(C, 'every plan step needs en and ar')
      if ((c.phrases?.length || 0) < L.phrases) bad(C, `needs at least ${L.phrases} phrases from the unit`)
      for (const p of c.phrases || []) if (!p.ar?.trim()) bad(C, `phrase without Arabic: ${p.en}`)
      const mw = (c.model || '').split(/\s+/).filter(Boolean).length
      if (mw < Math.min(c.words, L.modelWords) || mw > Math.max(c.words, L.modelWords) + 60) bad(C, `model should be about ${c.words} words (has ${mw})`)
      if (!c.modelAr?.trim()) bad(C, 'needs modelAr')
      if ((c.checklistAr?.length || 0) < 4) bad(C, 'needs at least 4 checklist points')
    }
    if (u.translations) {
      if (u.translations.length < L.translations) bad(W, `translations needs at least ${L.translations} sentences, has ${u.translations.length}`)
      for (const t of u.translations) {
        if (!t.ar?.trim()) bad(W, `translation without Arabic: ${t.en}`)
        if (!isSentence(t.en)) bad(W, `translation is not a complete sentence: ${t.en}`)
        else if (!anyCorpus.includes(norm(t.en))) bad(W, `translation sentence not in the book: ${t.en}`)
      }
    }
    // sentences used for "build the sentence" and listening must be the book's own
    if ((u.sentences?.length || 0) < L.sentences) bad(W, `needs at least ${L.sentences} sentences`)
    for (const s of u.sentences || []) if (!corpus.includes(norm(s))) bad(W, `sentence not in the book: ${s}`)
  }
  if (m.progressTest) {
    checkExercises(`module${n} progressTest`, m.progressTest.exercises, L.progressTest)
    if (m.progressTest.reading) checkReading(`module${n} progressTest reading`, m.progressTest.reading, wbCorpus, 3)
  }
  if (m.review) {
    checkExercises(`module${n} review`, m.review.exercises, L.review)
    if (m.review.reading) checkReading(`module${n} review reading`, m.review.reading, corpus, 4)
  }
}

if (problems.length) {
  console.log(`${problems.length} problem(s):`)
  for (const p of problems.slice(0, 200)) console.log(' - ' + p)
  process.exit(1)
}
console.log(`OK — ${bookId}${only ? ` module ${only}` : ''} passes every check`)
