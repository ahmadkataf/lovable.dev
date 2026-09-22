// Checks every vocab example against the verbatim book text extracted from the PDF.
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const BOOK = process.argv[2] || 'g8'
const EXTRACT = `book-source/${BOOK}`
const tmp = path.resolve('node_modules/.cache/emar-data-audit.mjs')
fs.mkdirSync(path.dirname(tmp), { recursive: true })
await build({ entryPoints: [`src/books/${BOOK}/index.ts`], bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error' })
const { modules } = await import(pathToFileURL(tmp).href)

import { bookCorpus, norm } from './book-corpus.mjs'
const report = []
let total = 0, inBook = 0

for (const m of modules) {
  const md = fs.readFileSync(path.join(EXTRACT, `module${m.number}.md`), 'utf8')
  const corpus = bookCorpus(md)
  for (const u of m.units) {
    const unitCorpus = norm([
      ...u.reading.paragraphs,
      ...u.grammar.examples,
      ...u.sentences,
      ...(u.writing?.model || []),
      ...(u.quotes || []).map(q => q.text),
      ...(u.listening?.items || []),
      ...u.grammar.exercises.map(e => [e.prompt, typeof e.answer === 'string' ? e.answer : '', ...(e.options || [])].join(' ')),
    ].join(' \n '))
    for (const w of u.vocab) {
      if (!w.example) continue
      total++
      const ex = norm(w.example)
      const hit = corpus.includes(ex) || unitCorpus.includes(ex)
      if (hit) inBook++
      else report.push({ unit: u.id, word: w.en, example: w.example })
    }
  }
}
console.log(`examples: ${total}, found verbatim in book/unit text: ${inBook}, NOT found: ${report.length}`)
const byUnit = {}
for (const r of report) (byUnit[r.unit] ||= []).push(r)
for (const [u, list] of Object.entries(byUnit)) console.log(`${u}: ${list.length}`)
fs.writeFileSync('/tmp/claude-0/-home-user-lovable-dev/d7f98752-50cd-5255-b1ac-66dae4a1121c/scratchpad/bad-examples.json', JSON.stringify(byUnit, null, 1))
console.log('\nsample:', report.slice(0, 8).map(r => `${r.unit} ${r.word}: ${r.example}`).join('\n'))
