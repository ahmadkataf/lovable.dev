// Checks Baccalaureate (Grade 12) papers against the layout of the real Term 1 paper:
//   A  42: passage + 3 questions to answer (18) + 2 "find words" (12) + 2 "correct the information" (12)   Q1–7
//   B  36: passage + 4 MCQ (24) + 2 "complete with information from the text" (12)                        Q8–13
//   III 54: 9 MCQ (vocabulary, idioms, grammar, pronunciation, word forms)                                Q14–22
//   IV 18: 3 gaps, one functional word each          V 24: 3 questions about the underlined words
//   VI 32: 4 rewrites as required in brackets        VII 18: 3 verbs in brackets
//   VIII 12: 2 sentences completed with clauses      IX 14: translation, one each way
//   X  50: a composition of no less than 80 words with the points to include        = 300 marks
// Grade 9 papers follow the real 2026 Basic Education Certificate paper (400 marks, 90 minutes):
//   A 50: passage + 5 MCQ          B 50: passage + 3 true/false (30) + 2 questions to answer (20)
//   C 150: 15 MCQ (vocabulary, prepositions, grammar, pronunciation)   D 50: match 5 items with a–e
//   E 30: 3 questions about the underlined words     F 20: 2 personal questions to answer
//   G 50: a 50-word paragraph about ONE of two topics                                     = 400 marks
// Generated papers must keep their passages in the book (the real paper may quote other texts).
//   node scripts/check-bac-exams.mjs [book] [file-substring]
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { norm, stripGlossNumbers } from './book-corpus.mjs'

const [bookId = 'g12', filter = ''] = process.argv.slice(2)
const dir = `src/books/${bookId}/exams`
const files = fs.readdirSync(dir).filter(f => /^term\d-[a-z]\.ts$/.test(f) && f.includes(filter))
const problems = []
const bad = (w, m) => problems.push(`${w}: ${m}`)
const cache = path.resolve('node_modules/.cache')
fs.mkdirSync(cache, { recursive: true })
// the Student's Book and the Activity Book: the real exam takes its passages from both
const sources = [1, 2, 3, 4, 5, 6].flatMap(n => [`book-source/${bookId}/module${n}.md`, `book-source/${bookId}/workbook-module${n}.md`]).filter(f => fs.existsSync(f))
  .map(f => stripGlossNumbers(fs.readFileSync(f, 'utf8')).replace(/^## Page \d+\s*$/gm, ' ').replace(/^\s*\d{1,3}\s*$/gm, ' '))
const corpus = sources.map(norm).join(' ')
// Some reading texts are printed with numbered gaps that students fill with the phrases listed above them
// ("Read the text and put the phrases A-H in the correct place"). A passage may show such a text completed,
// as long as every filled gap holds one of the book's listed phrases.
const GAP_TOKEN = 'qqgapqq'
const gapCorpus = sources.map(t => norm(t.replace(/\d?\s*_{3,}/g, ` ${GAP_TOKEN} `))).join(' ')
const fillPhrases = [...new Set(sources.flatMap(t => [...t.matchAll(/^\s*[A-H]\s+(\S.*?)\s*$/gm)].map(m => norm(m[1]))))]
  .filter(p => p.split(' ').length >= 2).sort((a, b) => b.length - a.length)
function inBook(sentence) {
  const s = norm(sentence)
  if (corpus.includes(s)) return true
  const hits = fillPhrases.filter(p => s.includes(p))
  if (!hits.length || hits.length > 6) return false
  for (let mask = 1; mask < 1 << hits.length; mask++) {
    let t = s
    hits.forEach((p, i) => { if (mask & (1 << i)) t = t.split(p).join(GAP_TOKEN) })
    if (gapCorpus.includes(norm(t))) return true
  }
  return false
}

const words = s => s.trim().split(/\s+/).filter(Boolean).length
const W = 'write'
const BAC = [
  { letter: 'A', marks: 42, passage: true, groups: [{ marks: 18, kind: W, count: 3 }, { marks: 12, kind: W, count: 2 }, { marks: 12, kind: W, count: 2 }] },
  { letter: 'B', marks: 36, passage: true, groups: [{ marks: 24, kind: 'mcq', count: 4 }, { marks: 12, kind: W, count: 2 }] },
  { letter: 'III', marks: 54, kind: 'mcq', count: 9 },
  { letter: 'IV', marks: 18, kind: W, count: 3 },
  { letter: 'V', marks: 24, kind: W, count: 3, underline: true },
  { letter: 'VI', marks: 32, kind: W, count: 4, bracket: true },
  { letter: 'VII', marks: 18, kind: W, count: 3, bracket: true },
  { letter: 'VIII', marks: 12, kind: W, count: 2 },
  { letter: 'IX', marks: 14, kind: W, count: 2 },
  { letter: 'X', marks: 50, writing: true },
]
const G9 = [
  { letter: 'A', marks: 50, passage: true, groups: [{ marks: 50, kind: 'mcq', count: 5 }] },
  { letter: 'B', marks: 50, passage: true, groups: [{ marks: 30, kind: 'truefalse', count: 3 }, { marks: 20, kind: W, count: 2 }] },
  { letter: 'C', marks: 150, kind: 'mcq', count: 15 },
  { letter: 'D', marks: 50, kind: 'mcq', count: 5, options: 5 },
  { letter: 'E', marks: 30, kind: W, count: 3, underline: true },
  { letter: 'F', marks: 20, kind: W, count: 2 },
  { letter: 'G', marks: 50, writing: true },
]
// what each book's final paper looks like
const PAPER = {
  g12: { layout: BAC, total: 300, words: 80, model: [80, 140], passage: [140, 260], name: 'Baccalaureate' },
  g9: { layout: G9, total: 400, words: 50, model: [45, 140], passage: [90, 220], name: 'Basic Education Certificate' },
}[bookId] || null
if (!PAPER) { console.log(`no exam layout for ${bookId}`); process.exit(1) }
const LAYOUT = PAPER.layout

const answerCounts = {}
for (const f of files) {
  const out = `${cache}/bac-exam-${bookId}-${f}.mjs`
  try { await build({ entryPoints: [path.join(dir, f)], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' }) }
  catch (e) { bad(f, `does not compile: ${e.message.split('\n')[0]}`); continue }
  const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`)
  const exam = Object.values(mod)[0]
  const X = `${f} (${exam?.id})`
  if (!exam?.sections) { bad(X, 'no exam exported'); continue }
  if (exam.totalMarks !== PAPER.total) bad(X, `must be marked out of ${PAPER.total}`)
  if (!exam.titleAr || !exam.sourceAr) bad(X, 'needs titleAr and sourceAr')
  if (exam.sections.reduce((a, s) => a + s.marks, 0) !== PAPER.total) bad(X, `section marks must add up to ${PAPER.total}`)
  const counts = answerCounts[f] = [0, 0, 0, 0]
  let n = 1
  const checkQ = (Q, q, kind, L) => {
    if (q.n !== n) bad(Q, `should be numbered ${n}`)
    n++
    if (q.kind !== kind) bad(Q, `should be a ${kind} question`)
    if (!q.explainAr?.trim()) bad(Q, 'missing explainAr')
    if (!q.promptAr?.trim()) bad(Q, 'missing promptAr')
    if (q.kind === 'mcq') {
      const k = L?.options || 4
      if (q.options?.length !== k) bad(Q, `needs ${k} options`)
      else if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== k) bad(Q, 'options repeat')
      if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < k)) bad(Q, `answer must be 0–${k - 1}`)
      else if (k === 4) counts[q.answer]++
      if (/\b(option|answer)\s*\(?[a-d]\)?\b|\([a-d]\)/i.test(q.explainAr)) bad(Q, 'explainAr must quote the option, not its letter')
    }
    if (q.kind === 'write' && !(q.accept?.length)) bad(Q, 'a written question needs its accepted answers')
    if (q.kind === 'truefalse' && typeof q.answer !== 'boolean') bad(Q, 'a true/false answer must be true or false')
    if (L?.underline && !/\{[^}]+\}/.test(q.prompt)) bad(Q, 'needs the {underlined} words')
    if (L?.bracket && !/\([^)]+\)/.test(q.prompt)) bad(Q, 'needs what is required in (brackets)')
  }
  LAYOUT.forEach((L, i) => {
    const s = exam.sections[i]
    const S = `${X} ${L.letter}`
    if (!s || s.letter !== L.letter) { bad(S, 'missing or out of order'); return }
    if (s.marks !== L.marks) bad(S, `must be worth ${L.marks} marks`)
    if (!s.title || !s.titleAr) bad(S, 'needs the printed instruction and its Arabic')
    if (L.passage) {
      const p = s.passage
      if (!p) { bad(S, 'needs a passage'); return }
      const text = p.paragraphs.join(' ').replace(/[{}]/g, '')
      const nw = words(text)
      if (!exam.real && (nw < PAPER.passage[0] || nw > PAPER.passage[1])) bad(S, `passage should be ${PAPER.passage[0]}–${PAPER.passage[1]} words like the real paper (has ${nw})`)
      if (p.paragraphsAr?.length !== p.paragraphs.length) bad(S, 'one Arabic translation per paragraph')
      if (!exam.real) {
        // every sentence of a generated passage is the book's own
        for (const sent of text.split(/(?<=[.!?])\s+/)) if (words(sent) >= 4 && !inBook(sent)) bad(S, `passage sentence not in the book: "${sent.slice(0, 70)}"`)
      }
      const gs = s.groups || []
      if (gs.length !== L.groups.length) { bad(S, `needs ${L.groups.length} tasks`); return }
      L.groups.forEach((G, gi) => {
        const g = gs[gi]
        if (g.marks !== G.marks) bad(`${S} task ${gi + 1}`, `must be worth ${G.marks} marks`)
        if (!g.title || !g.titleAr) bad(`${S} task ${gi + 1}`, 'needs its instruction and Arabic')
        if (g.questions.length !== G.count) bad(`${S} task ${gi + 1}`, `needs exactly ${G.count} questions`)
        g.questions.forEach(q => checkQ(`${S} Q${q.n}`, q, G.kind))
      })
      return
    }
    if (L.writing) {
      const w = s.writing
      if (!w) { bad(S, 'needs a writing task'); return }
      if (w.words !== PAPER.words) bad(S, `the task is a paragraph of ${PAPER.words} words`)
      if (!w.topic || !w.topicAr || !w.modelAr) bad(S, 'needs topic, topicAr and modelAr')
      if ((w.points?.length || 0) < 2) bad(S, 'needs the points to include')
      if (words(w.model) < PAPER.model[0] || words(w.model) > PAPER.model[1]) bad(S, `model should be ${PAPER.model[0]}–${PAPER.model[1]} words (has ${words(w.model)})`)
      if ((w.checklistAr?.length || 0) < 4) bad(S, 'needs at least 4 checklist points')
      return
    }
    const qs = s.questions || []
    if (qs.length !== L.count) bad(S, `needs exactly ${L.count} questions`)
    qs.forEach(q => checkQ(`${S} Q${q.n}`, q, L.kind, L))
    if (L.letter === 'IX' && qs.length === 2) {
      const ar = qs.map(q => /[؀-ۿ]/.test(q.prompt.replace(/^[^:]*:/, '')))
      if (ar[0] === ar[1]) bad(S, 'translate one sentence into Arabic and one into English')
    }
  })
  if (!exam.real) {
    const max = Math.max(...counts), total = counts.reduce((a, b) => a + b, 0)
    if (total && max / total > 0.4) bad(X, `right MCQ answers cluster on one letter (${counts.join('/')})`)
  }
}

if (problems.length) {
  console.log(`${problems.length} problem(s):`)
  for (const p of problems.slice(0, 200)) console.log(' - ' + p)
  process.exit(1)
}
console.log(`OK — ${files.length} ${bookId} paper(s) follow the ${PAPER.name} layout`)
for (const [f, c] of Object.entries(answerCounts)) console.log(`   ${f}: MCQ answers a/b/c/d = ${c.join('/')}`)
