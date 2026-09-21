import type { Exercise, Grammar, Lesson, LessonKind, Module, Unit, Word } from './types'
import type { Progress } from './progress'
import { wordStrength } from './progress'

// ---------- utils ----------
export function shuffle<T>(arr: T[], rnd = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
function pick<T>(arr: T[], n: number, exclude?: (x: T) => boolean): T[] {
  return shuffle(exclude ? arr.filter(x => !exclude(x)) : arr).slice(0, n)
}
export function tokenize(s: string): string[] {
  return s.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
}
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,!?;:"'’“”()]/g, '').replace(/\s+/g, ' ').trim()
}

// ---------- lesson plan per unit ----------
export const LESSON_TEMPLATE: { kind: LessonKind; title: string; icon: string; xp: number }[] = [
  { kind: 'vocab', title: 'كلمات ١', icon: '📚', xp: 15 },
  { kind: 'vocab', title: 'كلمات ٢', icon: '📖', xp: 15 },
  { kind: 'reading', title: 'القراءة', icon: '📰', xp: 20 },
  { kind: 'grammar', title: 'القواعد', icon: '🧩', xp: 20 },
  { kind: 'grammar', title: 'تدريب القواعد', icon: '🧠', xp: 20 },
  { kind: 'listening', title: 'استماع ونطق', icon: '🎧', xp: 15 },
  { kind: 'writing', title: 'تركيب الجمل', icon: '✍️', xp: 15 },
  { kind: 'review', title: 'مراجعة الوحدة', icon: '🏆', xp: 30 },
]

/** position of the first grammar lesson in LESSON_TEMPLATE */
export const GRAMMAR_INDEX = LESSON_TEMPLATE.findIndex(l => l.kind === 'grammar')

export function lessonsForUnit(u: Unit): Lesson[] {
  return LESSON_TEMPLATE.map((t, i) => ({ id: `${u.id}-l${i + 1}`, unitId: u.id, index: i, ...t }))
}

export function bossLesson(m: Module): Lesson {
  return { id: `m${m.number}-boss`, unitId: m.units[m.units.length - 1].id, index: 99, kind: 'boss', title: `اختبار الوحدة ${m.number}`, icon: '👑', xp: 50 }
}

/** The book's own Review section, where the book prints one. */
export function reviewLesson(m: Module): Lesson | null {
  if (!m.review) return null
  return { id: `m${m.number}-review`, unitId: m.units[m.units.length - 1].id, index: 100, kind: 'bookReview', title: m.review.titleAr, icon: '📋', xp: 60 }
}

// ---------- exercise builders ----------
function distractorsAr(word: Word, pool: Word[], n = 3): string[] {
  const others = pool.filter(w => w.en !== word.en && w.ar !== word.ar)
  return pick(others, n).map(w => w.ar)
}
function distractorsEn(word: Word, pool: Word[], n = 3): string[] {
  const others = pool.filter(w => w.en !== word.en)
  // prefer words with similar length / same starting letter for difficulty
  const similar = others.filter(w => w.en[0]?.toLowerCase() === word.en[0]?.toLowerCase())
  const chosen = [...pick(similar, 1), ...pick(others, n)].filter((w, i, a) => a.findIndex(x => x.en === w.en) === i).slice(0, n)
  return chosen.map(w => w.en)
}
function withAnswer(correct: string, wrongs: string[]): { options: string[]; answer: number } {
  const options = shuffle([correct, ...wrongs])
  return { options, answer: options.indexOf(correct) }
}

export function exChooseAr(word: Word, pool: Word[]): Exercise {
  return { kind: 'choose_ar', word, ...withAnswer(word.ar, distractorsAr(word, pool)) }
}
export function exChooseEn(word: Word, pool: Word[]): Exercise {
  return { kind: 'choose_en', word, ...withAnswer(word.en, distractorsEn(word, pool)) }
}
export function exListen(word: Word, pool: Word[]): Exercise {
  return { kind: 'listen', word, ...withAnswer(word.en, distractorsEn(word, pool)) }
}
export function exType(word: Word): Exercise { return { kind: 'type_en', word } }
export function exMatch(words: Word[]): Exercise {
  return { kind: 'match', pairs: words.slice(0, 5).map(w => ({ en: w.en, ar: w.ar })) }
}
export function exBuild(target: string, pool: Word[], promptAr?: string): Exercise {
  const tokens = tokenize(target)
  const extra = pick(pool, 3).map(w => w.en.split(' ')[0]).filter(t => !tokens.map(normalize).includes(normalize(t)))
  return { kind: 'build', target, tiles: shuffle([...tokens, ...extra.slice(0, 2)]), promptAr }
}
export function exListenSentence(text: string, all: string[]): Exercise {
  const wrongs = pick(all.filter(s => s !== text), 2)
  return { kind: 'listen_sentence', text, ...withAnswer(text, wrongs) }
}

function grammarExercises(g: Grammar, pool: Word[]): Exercise[] {
  return g.exercises.map((e): Exercise => {
    switch (e.type) {
      case 'mcq': return { kind: 'mcq', prompt: e.prompt || '', options: e.options || [], answer: e.answer as number, explainAr: e.explainAr }
      case 'fill': return { kind: 'fill', prompt: e.prompt || '', options: e.options || [], answer: e.answer as number, explainAr: e.explainAr }
      case 'truefalse': return { kind: 'truefalse', statement: e.prompt || '', answer: e.answer as boolean, explainAr: e.explainAr }
      case 'build':
      case 'order': return exBuild(e.answer as string, pool, e.prompt)
    }
  })
}

// ---------- lesson generation ----------
export function buildLesson(lesson: Lesson, unit: Unit, module: Module, progress: Progress): Exercise[] {
  const pool = unit.vocab
  const half = Math.ceil(pool.length / 2)
  const allSentences = module.units.flatMap(u => u.sentences)

  switch (lesson.kind) {
    case 'vocab': {
      const words = lesson.index === 0 ? pool.slice(0, half) : pool.slice(half)
      const set = shuffle(words).slice(0, 8)
      const ex: Exercise[] = []
      // teach in pairs: intro card, then immediate checks
      set.forEach((w, i) => {
        ex.push({ kind: 'intro', word: w })
        ex.push(exChooseAr(w, pool))
        if (i % 2 === 1) ex.push(exChooseEn(set[i - 1], pool))
        if (i % 3 === 2) ex.push(exListen(w, pool))
      })
      ex.push(exMatch(shuffle(set)))
      ex.push(...shuffle(set).slice(0, 3).map(w => exType(w)))
      return ex
    }
    case 'reading': {
      const r = unit.reading
      const ex: Exercise[] = []
      const readWords = pool.filter(w => r.paragraphs.join(' ').toLowerCase().includes(w.en.toLowerCase().split(' ')[0]))
      shuffle(readWords).slice(0, 3).forEach(w => ex.push({ kind: 'intro', word: w }))
      r.questions.forEach(q => ex.push({ kind: 'read', title: r.title, paragraphs: r.paragraphs, paragraphsAr: r.paragraphsAr, question: q }))
      ;(r.trueFalse || []).forEach(t => ex.push({ kind: 'truefalse', statement: t.statement, answer: t.answer }))
      shuffle(readWords).slice(0, 3).forEach(w => ex.push(exChooseAr(w, pool)))
      return ex
    }
    case 'grammar': {
      const all = grammarExercises(unit.grammar, pool)
      const half = Math.ceil(all.length / 2)
      // the first grammar lesson explains the rule and drills the easier half,
      // the second drills the rest so no authored exercise goes unused
      const mine = lesson.index === GRAMMAR_INDEX ? all.slice(0, half) : all.slice(half)
      const ex: Exercise[] = [{ kind: 'grammar_card', grammar: unit.grammar }]
      ex.push(...shuffle(mine).slice(0, 14))
      return ex
    }
    case 'bookReview': {
      const r = module.review
      if (!r) return []
      const ex: Exercise[] = []
      if (r.reading) {
        r.reading.questions.forEach(q => ex.push({ kind: 'read', title: r.reading!.title, paragraphs: r.reading!.paragraphs, paragraphsAr: r.reading!.paragraphsAr, question: q }))
        ;(r.reading.trueFalse || []).forEach(t => ex.push({ kind: 'truefalse', statement: t.statement, answer: t.answer }))
      }
      const all = module.units.flatMap(u => u.vocab)
      ex.push(...shuffle(grammarExercises({ ...module.units[0].grammar, exercises: r.exercises }, all)).slice(0, 20))
      return ex
    }
    case 'listening': {
      const ex: Exercise[] = []
      const words = shuffle(pool).slice(0, 6)
      words.forEach(w => ex.push(exListen(w, pool)))
      shuffle(unit.sentences).slice(0, 3).forEach(s => ex.push(exListenSentence(s, allSentences)))
      if (unit.pronunciation) {
        unit.pronunciation.groups.forEach(g => {
          const w = shuffle(g.words)[0]
          const others = unit.pronunciation!.groups.filter(x => x !== g).map(x => x.label)
          if (w && others.length) ex.push({ kind: 'mcq', prompt: `🔊 "${w}" — أي صوت تسمع؟`, audio: w, ...withAnswer(g.label, others.slice(0, 3)), explainAr: unit.pronunciation!.ruleAr })
        })
      }
      shuffle(unit.sentences).slice(0, 2).forEach(s => ex.push({ kind: 'speak', text: s }))
      return shuffle(ex)
    }
    case 'writing': {
      const ex: Exercise[] = []
      shuffle(unit.sentences).slice(0, 6).forEach(s => ex.push(exBuild(s, pool)))
      shuffle(pool).slice(0, 3).forEach(w => ex.push(exType(w)))
      if (unit.writing?.linkers?.length) {
        const g = unit.grammar
        ex.push(...grammarExercises(g, pool).filter(e => e.kind === 'fill').slice(0, 2))
      }
      return ex
    }
    case 'review': {
      const weak = pool.slice().sort((a, b) => wordStrength(progress.words[a.en.toLowerCase()]) - wordStrength(progress.words[b.en.toLowerCase()]))
      const ex: Exercise[] = []
      weak.slice(0, 4).forEach(w => ex.push(exChooseAr(w, pool)))
      weak.slice(4, 7).forEach(w => ex.push(exChooseEn(w, pool)))
      ex.push(exMatch(shuffle(pool)))
      ex.push(...shuffle(grammarExercises(unit.grammar, pool)).slice(0, 4))
      shuffle(unit.reading.questions).slice(0, 2).forEach(q => ex.push({ kind: 'read', title: unit.reading.title, paragraphs: unit.reading.paragraphs, paragraphsAr: unit.reading.paragraphsAr, question: q }))
      shuffle(unit.sentences).slice(0, 2).forEach(s => ex.push(exBuild(s, pool)))
      shuffle(pool).slice(0, 2).forEach(w => ex.push(exListen(w, pool)))
      weak.slice(0, 2).forEach(w => ex.push(exType(w)))
      return shuffle(ex)
    }
    case 'boss': {
      const all = module.units.flatMap(u => u.vocab)
      const ex: Exercise[] = []
      module.units.forEach(u => {
        shuffle(u.vocab).slice(0, 3).forEach(w => ex.push(exChooseAr(w, all)))
        shuffle(u.vocab).slice(0, 2).forEach(w => ex.push(exChooseEn(w, all)))
        ex.push(...shuffle(grammarExercises(u.grammar, all)).slice(0, 3))
        shuffle(u.reading.questions).slice(0, 1).forEach(q => ex.push({ kind: 'read', title: u.reading.title, paragraphs: u.reading.paragraphs, paragraphsAr: u.reading.paragraphsAr, question: q }))
        shuffle(u.sentences).slice(0, 2).forEach(s => ex.push(exBuild(s, all)))
        shuffle(u.vocab).slice(0, 2).forEach(w => ex.push(exListen(w, all)))
      })
      ex.push(exMatch(shuffle(all)))
      return shuffle(ex)
    }
  }
}

// ---------- practice mode: weakest words across all learned units ----------
export function buildPractice(modules: Module[], progress: Progress, unlockedUnitIds: Set<string>): Exercise[] {
  const words = modules.flatMap(m => m.units.filter(u => unlockedUnitIds.has(u.id)).flatMap(u => u.vocab))
  if (words.length === 0) return []
  const now = Date.now()
  const scored = words.map(w => {
    const s = progress.words[w.en.toLowerCase()]
    const due = s ? (s.due <= now ? 1 : 0) : 0.5
    return { w, score: wordStrength(s) - due }
  }).sort((a, b) => a.score - b.score)
  const set = scored.slice(0, 10).map(x => x.w)
  const ex: Exercise[] = []
  set.forEach((w, i) => {
    const k = i % 4
    if (k === 0) ex.push(exChooseAr(w, words))
    else if (k === 1) ex.push(exChooseEn(w, words))
    else if (k === 2) ex.push(exListen(w, words))
    else ex.push(exType(w))
  })
  ex.push(exMatch(shuffle(set)))
  return ex
}

/** Practice for one unit's grammar rule only, started from the book screen. */
export function buildGrammarPractice(unit: Unit): Exercise[] {
  const ex = grammarExercises(unit.grammar, unit.vocab)
  return [{ kind: 'grammar_card', grammar: unit.grammar } as Exercise, ...shuffle(ex).slice(0, 15)]
}

export function checkBuild(target: string, tiles: string[]): boolean {
  return normalize(tiles.join(' ')) === normalize(target)
}
export function checkTyped(word: Word, typed: string): boolean {
  const t = normalize(typed)
  if (!t) return false
  const answers = [word.en, ...(word.en.includes('(') ? [word.en.replace(/\(.*?\)/g, '')] : [])].map(normalize)
  return answers.some(a => a === t || (a.length > 5 && levenshtein(a, t) <= 1))
}
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}
