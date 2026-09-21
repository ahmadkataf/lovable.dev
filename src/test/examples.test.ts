import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { modules } from '../data'

// Every example sentence a student sees must be printed in that unit's own pages
// of the book. book-source/moduleN.md holds the verbatim text of those pages.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

describe('vocabulary examples come from the book', () => {
  for (const m of modules) {
    const md = norm(fs.readFileSync(path.join('book-source', `module${m.number}.md`), 'utf8'))
    for (const u of m.units) {
      const unitText = norm([
        ...u.reading.paragraphs,
        ...u.grammar.examples,
        ...u.sentences,
        ...(u.writing?.model || []),
        ...(u.quotes || []).map(q => q.text),
        ...(u.listening?.items || []),
        ...u.grammar.exercises.map(e => [e.prompt, typeof e.answer === 'string' ? e.answer : '', ...(e.options || [])].join(' ')),
      ].join(' \n '))
      it(`unit ${u.id} (${u.title}) uses only sentences printed in the book`, () => {
        const strays: string[] = []
        for (const w of u.vocab) {
          if (!w.example) continue
          const ex = norm(w.example)
          if (!md.includes(ex) && !unitText.includes(ex)) strays.push(`${w.en}: ${w.example}`)
        }
        expect(strays, `examples not found in the book text:\n${strays.join('\n')}`).toEqual([])
      })

      it(`unit ${u.id} (${u.title}) shows examples as complete sentences`, () => {
        // A label, a heading, a task instruction or an exercise with an unresolved
        // choice teaches nothing; such words keep their definition without an example.
        const unusable: string[] = []
        for (const w of u.vocab) {
          const e = w.example?.trim()
          if (!e) continue
          const why: string[] = []
          if (/\([^)]*[-,][^)]*\)/.test(e)) why.push('unresolved choice')
          if (/^(write|tick|match|complete|choose|fill|underline|circle|listen|discuss)\b/i.test(e)) why.push('task instruction')
          if (!/[.!?]$/.test(e)) why.push('not a sentence')
          if (e.split(/\s+/).length < 3) why.push('too short')
          if (why.length) unusable.push(`${w.en} [${why.join(', ')}]: ${e}`)
        }
        expect(unusable, `examples that are not usable sentences:\n${unusable.join('\n')}`).toEqual([])
      })
    }
  }
})
