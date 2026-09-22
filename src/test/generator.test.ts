import { describe, it, expect } from 'vitest'
import { books } from './books'
import { bossLesson, buildGrammarPractice, buildLesson, buildPractice, checkBuild, lessonsForUnit, normalize, reviewLesson } from '../engine/generator'
import { judge } from '../components/Exercises'
import type { Exercise } from '../engine/types'

function correctValue(ex: Exercise): unknown {
  switch (ex.kind) {
    case 'choose_ar': case 'choose_en': case 'listen': case 'listen_sentence': case 'mcq': case 'fill': return ex.answer
    case 'read': return ex.question.answer
    case 'truefalse': return ex.answer ? 0 : 1
    case 'type_en': return ex.word.en
    case 'match': return true
    case 'build': {
      const want = normalize(ex.target).split(' '); const used = new Set<number>(); const idx: number[] = []
      for (const w of want) { const i = ex.tiles.findIndex((t, k) => !used.has(k) && normalize(t) === w); used.add(i); idx.push(i) }
      return idx
    }
    default: return undefined
  }
}

const empty = { xp: 0, hearts: 5, heartsAt: 0, streak: 0, lastActive: '', dailyXp: {}, dailyGoal: 30, lessons: {}, words: {}, name: '', sound: true, autoSpeak: true }

for (const { book, modules } of books) describe(`exercise generator — ${book.id}`, () => {
  for (const m of modules) {
    for (const u of m.units) {
      it(`generates valid lessons for ${u.id} (${u.title})`, () => {
        for (let round = 0; round < 5; round++) {
          const extra = reviewLesson(m)
          for (const lesson of [...lessonsForUnit(u), bossLesson(m), ...(extra ? [extra] : [])]) {
            const exs = buildLesson(lesson, u, m, empty)
            expect(exs.length, `${lesson.id} has exercises`).toBeGreaterThanOrEqual(5)
            for (const ex of exs) {
              if ('options' in ex) {
                expect(ex.options.length).toBeGreaterThanOrEqual(2)
                expect(new Set(ex.options).size, `distinct options in ${lesson.id}: ${JSON.stringify(ex.options)}`).toBe(ex.options.length)
              }
              if (ex.kind === 'build') {
                expect(checkBuild(ex.target, (correctValue(ex) as number[]).map(i => ex.tiles[i])), `build solvable: ${ex.target} / ${ex.tiles}`).toBe(true)
              }
              if (ex.kind === 'match') expect(ex.pairs.length).toBeGreaterThanOrEqual(3)
              expect(judge(ex, correctValue(ex)), `judge accepts the correct answer for ${ex.kind} in ${lesson.id}`).toBe(true)
            }
          }
        }
      })
    }
  }
  for (const m of modules) for (const u of m.units) {
    it(`builds grammar practice for ${u.id} with every authored exercise usable`, () => {
      expect(u.grammar.exercises.length, 'enough grammar practice per unit').toBeGreaterThanOrEqual(14)
      for (let round = 0; round < 3; round++) {
        const ex = [...buildGrammarPractice(u), ...buildGrammarPractice(u, 'vocabFocus'), ...buildGrammarPractice(u, 'everyday')]
        expect(ex.length).toBeGreaterThanOrEqual(6)
        for (const e of ex) expect(judge(e, correctValue(e)), `${e.kind} in ${u.id} grammar practice`).toBe(true)
      }
    })
  }

  it('builds a practice session from unlocked units', () => {
    const ex = buildPractice(modules, empty, new Set(['u1', 'u2']))
    expect(ex.length).toBeGreaterThanOrEqual(8)
    for (const e of ex) expect(judge(e, correctValue(e))).toBe(true)
  })
})
