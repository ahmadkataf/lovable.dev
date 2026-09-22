// Checks exam papers against the format of the real final exam (Grade 8):
//   A 50 marks: passage + 5 MCQ (a–d)      B 50: passage + 5 True/False
//   C 200: 20 MCQ (a–d)                    D 40: 4 "ask about the underlined words"
//   E 20: 4 "choose the wrong part"        F 40: a 50-word paragraph      = 400 marks, 60 minutes
// Generated papers must also keep section C inside the term's units (vocabulary answers come
// from those units' word lists) and mix item types like the real paper.
//   node scripts/check-exams.mjs [file-substring]
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const filter = process.argv[2] || ''
const dir = 'src/books/g8/exams'
const files = fs.readdirSync(dir).filter(f => /^term\d-[a-z]\.ts$/.test(f) && f.includes(filter))
const problems = []
const bad = (w, m) => problems.push(`${w}: ${m}`)

const cache = path.resolve('node_modules/.cache')
fs.mkdirSync(cache, { recursive: true })
await build({ entryPoints: ['src/books/g8/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: `${cache}/exam-book.mjs`, logLevel: 'silent' })
const { modules } = await import(pathToFileURL(`${cache}/exam-book.mjs`).href)
const termWords = term => new Set(modules.filter(m => (term === 1 ? m.number <= 3 : m.number >= 4))
  .flatMap(m => m.units.flatMap(u => u.vocab.map(w => w.en.toLowerCase()))))

const words = s => s.trim().split(/\s+/).filter(Boolean).length
const LAYOUT = [
  { letter: 'A', marks: 50, kind: 'mcq', count: 5, from: 1, passage: true },
  { letter: 'B', marks: 50, kind: 'truefalse', count: 5, from: 6, passage: true },
  { letter: 'C', marks: 200, kind: 'mcq', count: 20, from: 11 },
  { letter: 'D', marks: 40, kind: 'ask', count: 4, from: 31 },
  { letter: 'E', marks: 20, kind: 'wrongpart', count: 4, from: 35 },
  { letter: 'F', marks: 40, writing: true },
]

for (const f of files) {
  const out = `${cache}/exam-${f}.mjs`
  try { await build({ entryPoints: [path.join(dir, f)], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' }) }
  catch (e) { bad(f, `does not compile: ${e.message.split('\n')[0]}`); continue }
  const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`)
  const exam = Object.values(mod)[0]
  const W = `${f} (${exam?.id})`
  if (!exam?.sections) { bad(W, 'no exam exported'); continue }
  if (exam.minutes !== 60 || exam.totalMarks !== 400) bad(W, 'must be 60 minutes and 400 marks')
  if (!exam.titleAr || !exam.sourceAr) bad(W, 'needs titleAr and sourceAr')
  if (exam.sections.reduce((a, s) => a + s.marks, 0) !== 400) bad(W, 'section marks must add up to 400')
  LAYOUT.forEach((L, i) => {
    const s = exam.sections[i]
    const S = `${W} ${L.letter}`
    if (!s || s.letter !== L.letter) { bad(S, 'missing or out of order'); return }
    if (s.marks !== L.marks) bad(S, `must be worth ${L.marks} marks`)
    if (!s.title || !s.titleAr) bad(S, 'needs the printed instruction and its Arabic')
    if (L.passage) {
      const p = s.passage
      if (!p) { bad(S, 'needs a passage'); return }
      const n = words(p.paragraphs.join(' ').replace(/[{}]/g, ''))
      if (!exam.real && (n < 170 || n > 280)) bad(S, `passage should be 170–280 words like the real paper (has ${n})`)
      if (p.paragraphsAr?.length !== p.paragraphs.length) bad(S, 'one Arabic translation per paragraph')
    }
    if (L.writing) {
      const w = s.writing
      if (!w) { bad(S, 'needs a writing task'); return }
      if (w.words !== 50) bad(S, 'the task is a 50-word paragraph')
      if (!w.topic || !w.topicAr || !w.modelAr) bad(S, 'needs topic, topicAr and modelAr')
      if (words(w.model) < 50 || words(w.model) > 85) bad(S, `model paragraph should be 50–85 words (has ${words(w.model)})`)
      if ((w.checklistAr?.length || 0) < 3) bad(S, 'needs at least 3 checklist points')
      return
    }
    const qs = s.questions || []
    if (qs.length !== L.count) bad(S, `needs exactly ${L.count} questions`)
    qs.forEach((q, k) => {
      const Q = `${S} Q${q.n}`
      if (q.n !== L.from + k) bad(Q, `should be numbered ${L.from + k}`)
      if (q.kind !== L.kind) bad(Q, `should be a ${L.kind} question`)
      if (!q.explainAr?.trim()) bad(Q, 'missing explainAr')
      if (!q.promptAr?.trim()) bad(Q, 'missing promptAr')
      if (q.kind === 'mcq' || q.kind === 'ask') {
        if (q.options?.length !== 4) bad(Q, 'needs 4 options a–d')
        else if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== 4) bad(Q, 'options repeat')
        if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4)) bad(Q, 'answer must be 0–3')
      }
      if (q.kind === 'truefalse' && typeof q.answer !== 'boolean') bad(Q, 'answer must be true/false')
      if (q.kind === 'ask') {
        if ((q.prompt.match(/\{[^}]+\}/g) || []).length !== 1) bad(Q, 'underline exactly one part with {braces}')
        if (!q.options?.every(o => o.trim().endsWith('?'))) bad(Q, 'every option must be a question')
      }
      if (q.kind === 'wrongpart') {
        if ((q.prompt.match(/\{[^}]+\}/g) || []).length !== 4) bad(Q, 'mark exactly 4 parts with {braces}')
        if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4)) bad(Q, 'answer must be 0–3')
      }
    })
    // an explanation that names a letter goes wrong as soon as options are reordered
    for (const q of qs) if (/(الخيار|الخياران|خيار|الإجابة)[^a-z]{0,6}\b[a-d]\b|\([a-d]\)(?!\s*\S*\})/.test(q.explainAr || '') && q.kind !== 'wrongpart')
      bad(`${S} Q${q.n}`, 'explainAr names an option letter; quote the option text instead')
    if (L.letter === 'C' && !exam.real) {
      const count = t => qs.filter(q => q.topic === t).length
      if (qs.some(q => !q.topic)) bad(S, 'every generated section-C item needs a topic')
      if (count('pronunciation') < 3) bad(S, 'needs at least 3 pronunciation items like the real paper')
      if (count('vocab') < 4) bad(S, 'needs at least 4 vocabulary items like the real paper')
      const grammarItems = qs.length - count('pronunciation') - count('vocab') - count('wordform')
      if (grammarItems < 11) bad(S, 'needs at least 11 grammar items like the real paper')
      const vocab = termWords(exam.term)
      for (const q of qs.filter(q => q.topic === 'vocab')) {
        const a = String(q.options?.[q.answer] || '').toLowerCase().replace(/^to /, '')
        const known = [...vocab].some(v => v.replace(/^to /, '') === a || a.startsWith(v.replace(/^to /, '')) || v.startsWith(a))
        if (!known) bad(`${S} Q${q.n}`, `vocabulary answer "${a}" is not a word of Term ${exam.term}'s units`)
      }
    }
  })
}

// a paper whose right answers cluster on one letter can be passed by guessing that letter
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8')
  if (/\breal:\s*true/.test(src)) continue
  const pos = [...src.matchAll(/kind: '(?:mcq|ask)'[^\n]*?answer: (\d)/g)].map(m => +m[1])
  const most = Math.max(...[0, 1, 2, 3].map(i => pos.filter(p => p === i).length))
  if (pos.length && most / pos.length > 0.4) bad(f, `one letter holds ${most} of ${pos.length} right answers — run scripts/balance-exam-answers.py`)
}

if (!files.length) problems.push('no exam files found')
if (problems.length) { console.log(`${problems.length} problem(s):`); problems.slice(0, 120).forEach(p => console.log(' - ' + p)); process.exit(1) }
console.log(`OK — ${files.length} exam paper(s) match the final-exam format: ${files.join(', ')}`)
