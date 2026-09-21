// Collects every English string the app can speak, grouped per unit, into audio-src/texts.json
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const tmp = path.resolve('node_modules/.cache/emar-data.mjs')
fs.mkdirSync(path.dirname(tmp), { recursive: true })
await build({ entryPoints: ['src/data/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error' })
const { modules } = await import(pathToFileURL(tmp).href)

export const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase()
const groups = {}
const add = (g, t) => { if (!t || !t.trim()) return; (groups[g] ||= new Map()).set(norm(t), t.trim()) }

for (const m of modules) {
  for (const u of m.units) {
    const g = u.id
    for (const w of u.vocab) { add(g, w.en); add(g, w.example) }
    u.sentences.forEach(s => add(g, s))
    u.grammar.examples.forEach(s => add(g, s))
    for (const e of u.grammar.exercises) {
      if (e.type === 'fill') add(g, e.prompt.replace('___', e.options[e.answer]))
      else if (e.type === 'build' || e.type === 'order') add(g, e.answer)
      else if (e.type === 'truefalse') add(g, e.prompt)
      else if (e.type === 'mcq') { add(g, e.prompt); e.options.forEach(o => add(g, o)) }
    }
    if (e => e) for (const e of u.grammar.exercises) if ((e.type === 'fill' || e.type === 'mcq') && e.options) e.options.forEach(o => { if (o.split(' ').length <= 3) add(g, o) })
    add(g, u.reading.paragraphs.join(' '))
    ;(u.reading.trueFalse || []).forEach(t => add(g, t.statement))
    u.reading.questions.forEach(q => { add(g, q.q); q.options.forEach(o => add(g, o)) })
    u.pronunciation?.groups.forEach(gr => gr.words.forEach(w => add(g, w)))
    ;(u.writing?.model || []).forEach(p => add(g, p))
  }
  const g = `m${m.number}`
  m.focus?.glossary?.forEach(w => add(g, w.en))
  m.focus?.paragraphs && add(g, m.focus.paragraphs.join(' '))
}
const out = {}
let n = 0, chars = 0
for (const [g, map] of Object.entries(groups)) { out[g] = [...map.values()]; n += map.size; chars += [...map.values()].join('').length }
fs.mkdirSync('audio-src', { recursive: true })
fs.writeFileSync('audio-src/texts.json', JSON.stringify(out, null, 1))
console.log('groups', Object.keys(out).length, 'texts', n, 'chars', chars)
for (const [g, l] of Object.entries(out)) console.log(g, l.length, l.join('').length)
