import { describe, it, expect } from 'vitest'
import { books } from './books'

for (const { book, modules } of books) describe(`curriculum data — ${book.id}`, () => {
  it('has 6 modules with 2 units each', () => {
    expect(modules.length).toBe(6)
    for (const m of modules) expect(m.units.length).toBe(2)
  })
  for (const m of modules) for (const u of m.units) {
    describe(`unit ${u.id} ${u.title}`, () => {
      it('has enough vocabulary without duplicates', () => {
        expect(u.vocab.length).toBeGreaterThanOrEqual(20)
        const seen = new Set<string>()
        for (const w of u.vocab) {
          expect(w.en.trim().length).toBeGreaterThan(0)
          expect(w.ar.trim().length).toBeGreaterThan(0)
          expect(seen.has(w.en.toLowerCase())).toBe(false)
          seen.add(w.en.toLowerCase())
          if (w.def) expect(w.defAr?.trim().length, `${w.en} needs defAr`).toBeGreaterThan(0)
          if (w.example) expect(w.exampleAr?.trim().length, `${w.en} needs exampleAr`).toBeGreaterThan(0)
        }
      })
      it('has a reading text with valid questions', () => {
        expect(u.reading.paragraphs.join(' ').split(' ').length).toBeGreaterThan(60)
        expect(u.reading.questions.length).toBeGreaterThanOrEqual(4)
        expect(u.reading.paragraphsAr?.length, 'reading needs Arabic translation').toBe(u.reading.paragraphs.length)
        for (const q of u.reading.questions) {
          expect(q.qAr?.trim().length, `${q.q} needs qAr`).toBeGreaterThan(0)
          expect(q.options.length).toBeGreaterThanOrEqual(3)
          expect(q.answer).toBeGreaterThanOrEqual(0)
          expect(q.answer).toBeLessThan(q.options.length)
        }
      })
      it('has valid grammar exercises', () => {
        expect(u.grammar.exercises.length).toBeGreaterThanOrEqual(10)
        for (const e of u.grammar.exercises) {
          // a learner who cannot read the English sentence still needs to know what it says
          if (e.type !== 'build' && e.type !== 'order') {
            expect(e.promptAr?.trim().length, `${e.prompt} needs promptAr`).toBeGreaterThan(0)
            if (e.type === 'fill') {
              expect(e.promptAr, `${e.prompt}: the Arabic must keep the blank`).toContain('___')
              // after answering the learner sees the completed Arabic sentence
              expect(e.promptArFull?.trim().length, `${e.prompt} needs promptArFull`).toBeGreaterThan(0)
              expect(e.promptArFull, `${e.prompt}: the completed Arabic must not keep a blank`).not.toContain('___')
            }
          }
          if (e.type === 'mcq' || e.type === 'fill') {
            expect(e.options && e.options.length >= 3).toBe(true)
            expect(typeof e.answer).toBe('number')
            expect(e.answer as number).toBeLessThan(e.options!.length)
            if (e.type === 'fill') expect(e.prompt).toContain('___')
          } else if (e.type === 'truefalse') {
            expect(typeof e.answer).toBe('boolean')
          } else {
            expect(typeof e.answer).toBe('string')
            expect((e.answer as string).split(' ').length).toBeGreaterThanOrEqual(3)
          }
        }
      })
      it('has sentences for building', () => {
        expect(u.sentences.length).toBeGreaterThanOrEqual(8)
        for (const s of u.sentences) expect(s.split(' ').length).toBeGreaterThanOrEqual(3)
      })
    })
  }
})
