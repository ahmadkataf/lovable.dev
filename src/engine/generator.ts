import type { Exercise, Grammar, Lesson, LessonKind, Module, Unit, Word } from './types'
import type { Progress } from './progress'
import { wordStrength } from './progress'
import { splitSentences } from './text'

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
type Step = { kind: LessonKind; title: string; icon: string; xp: number; part?: number }

const STEP = {
  vocab1: { kind: 'vocab', title: 'كلمات ١', icon: '📚', xp: 15, part: 1 },
  vocab2: { kind: 'vocab', title: 'كلمات ٢', icon: '📖', xp: 15, part: 2 },
  reading: { kind: 'reading', title: 'القراءة', icon: '📰', xp: 20 },
  vocabFocus: { kind: 'vocabFocus', title: 'المفردات', icon: '🔤', xp: 20 },
  grammar1: { kind: 'grammar', title: 'القواعد', icon: '🧩', xp: 20, part: 1 },
  grammar2: { kind: 'grammar', title: 'تدريب القواعد', icon: '🧠', xp: 20, part: 2 },
  listening: { kind: 'listening', title: 'استماع ونطق', icon: '🎧', xp: 15 },
  everyday: { kind: 'everyday', title: 'Everyday English', icon: '💬', xp: 20 },
  writing: { kind: 'writing', title: 'تركيب الجمل', icon: '✍️', xp: 15 },
  workbook1: { kind: 'workbook', title: 'نصوص وتمارين', icon: '📒', xp: 25, part: 1 },
  workbook2: { kind: 'workbook', title: 'تمارين ٢', icon: '📗', xp: 25, part: 2 },
  translation: { kind: 'translation', title: 'الترجمة', icon: '🔁', xp: 20 },
  composition1: { kind: 'composition', title: 'الإنشاء', icon: '📝', xp: 30, part: 1 },
  composition2: { kind: 'composition', title: 'الإنشاء ٢', icon: '🖋️', xp: 30, part: 2 },
  review: { kind: 'review', title: 'مراجعة الوحدة', icon: '🏆', xp: 30 },
} satisfies Record<string, Step>

/** The lessons of a unit follow the book's sections. Units without a taught vocabulary
 *  point or an Everyday English section (Grade 8) keep exactly their previous lessons and ids. */
export function lessonsForUnit(u: Unit): Lesson[] {
  if (u.outline) return u.outline.lessons.map(l => ({ ...l, unitId: u.id }))
  const steps: Step[] = [STEP.vocab1, STEP.vocab2, STEP.reading]
  if (u.vocabFocus) steps.push(STEP.vocabFocus)
  steps.push(STEP.grammar1, STEP.grammar2, STEP.listening)
  if (u.everyday) steps.push(STEP.everyday)
  // the Activity Book, translation and composition lessons exist only where the book data has them
  if (u.workbook) steps.push(...(workbookParts(u) > 1 ? [STEP.workbook1, STEP.workbook2] : [STEP.workbook1]))
  if (u.translations?.length) steps.push(STEP.translation)
  if (u.compositions?.length) steps.push(STEP.composition1)
  if ((u.compositions?.length || 0) > 1) steps.push(STEP.composition2)
  steps.push(STEP.writing, STEP.review)
  return steps.map((t, i) => ({ id: `${u.id}-l${i + 1}`, unitId: u.id, index: i, ...t }))
}

export function bossLesson(m: Module): Lesson {
  return { id: `m${m.number}-boss`, unitId: m.units[m.units.length - 1].id, index: 99, kind: 'boss', title: `اختبار الوحدة ${m.number}`, icon: '👑', xp: 50 }
}

/** Which book a lesson comes from, so the learner always knows where they are. */
export type LessonSource = 'book' | 'workbook' | 'skills' | 'test'
export function lessonSource(l: Lesson): LessonSource {
  switch (l.kind) {
    case 'workbook': case 'progressTest': return 'workbook'
    case 'translation': case 'composition': case 'writing': case 'review': return 'skills'
    case 'boss': return 'test'
    default: return 'book'
  }
}
export const SOURCE_NAME: Record<LessonSource, string> = {
  book: '📘 كتاب الطالب',
  workbook: '📒 كتاب الأنشطة',
  skills: '🎯 مهارات الامتحان',
  test: '👑 اختبار',
}
/** "📒 كتاب الأنشطة · Unit 1 · ص 2–8" */
export function sourceLabel(l: Lesson, unit: Unit, module: Module): string {
  const src = lessonSource(l)
  if (l.kind === 'bookReview' && module.review) return `${SOURCE_NAME.book} · ${module.review.title} · ص ${module.review.pages}`
  if (l.kind === 'progressTest' && module.progressTest) return `${SOURCE_NAME.workbook} · ${module.progressTest.title} · ص ${module.progressTest.pages}`
  if (l.kind === 'boss') return `${SOURCE_NAME.test} · Module ${module.number}`
  const pages = src === 'book' ? unit.pages : src === 'workbook' ? unit.workbook?.pages : ''
  return `${SOURCE_NAME[src]} · Unit ${unit.number}${pages ? ` · ص ${pages}` : ''}`
}

const WORKBOOK_LESSON = 22
function workbookParts(u: Unit): number { return (u.workbook?.exercises.length || 0) > WORKBOOK_LESSON ? 2 : 1 }

/** The Activity Book's Progress Test, where the module has one. */
export function progressTestLesson(m: Module): Lesson | null {
  if (!m.progressTest) return null
  return { id: `m${m.number}-ptest`, unitId: m.units[m.units.length - 1].id, index: 101, kind: 'progressTest', title: m.progressTest.titleAr, icon: '🧪', xp: 60 }
}

/** The book's own Review section, where the book prints one. */
export function reviewLesson(m: Module): Lesson | null {
  if (!m.review) return null
  return { id: `m${m.number}-review`, unitId: m.units[m.units.length - 1].id, index: 100, kind: 'bookReview', title: m.review.titleAr, icon: '📋', xp: 60 }
}

// ---------- exercise builders ----------
// Two words can share an Arabic translation, so pick by the text shown, not by the word.
function distinctBy<T>(items: T[], key: (x: T) => string, taken: Set<string>, n: number): T[] {
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (taken.has(k)) continue
    taken.add(k)
    out.push(item)
    if (out.length === n) break
  }
  return out
}

function distractorsAr(word: Word, pool: Word[], n = 3): string[] {
  const others = shuffle(pool.filter(w => w.en !== word.en))
  return distinctBy(others, w => w.ar, new Set([word.ar]), n).map(w => w.ar)
}
function distractorsEn(word: Word, pool: Word[], n = 3): string[] {
  const others = pool.filter(w => w.en !== word.en)
  // one word starting with the same letter makes the choice a real one
  const similar = shuffle(others.filter(w => w.en[0]?.toLowerCase() === word.en[0]?.toLowerCase()))
  const taken = new Set([word.en.toLowerCase()])
  const chosen = [...distinctBy(similar, w => w.en.toLowerCase(), taken, 1), ...distinctBy(shuffle(others), w => w.en.toLowerCase(), taken, n)]
  return chosen.slice(0, n).map(w => w.en)
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
/** Spelling from dictation: a word, or a short sentence of the book. */
export function exDictation(text: string, word?: Word): Exercise { return { kind: 'dictation', text, word } }
function shortSentences(u: Unit): string[] { return u.sentences.filter(x => x.split(' ').length <= 10) }

export function exListenSentence(text: string, all: string[]): Exercise {
  const wrongs = distinctBy(shuffle(all.filter(s => s !== text)), s => s, new Set([text]), 2)
  return { kind: 'listen_sentence', text, ...withAnswer(text, wrongs) }
}

function grammarExercises(g: Grammar, pool: Word[]): Exercise[] {
  return g.exercises.map((e): Exercise => {
    switch (e.type) {
      case 'mcq': return { kind: 'mcq', prompt: e.prompt || '', promptAr: e.promptAr, options: e.options || [], answer: e.answer as number, explainAr: e.explainAr }
      case 'fill': return { kind: 'fill', prompt: e.prompt || '', promptAr: e.promptAr, promptArFull: e.promptArFull, options: e.options || [], answer: e.answer as number, explainAr: e.explainAr }
      case 'truefalse': return { kind: 'truefalse', statement: e.prompt || '', statementAr: e.promptAr, answer: e.answer as boolean, explainAr: e.explainAr }
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
      const words = lesson.part === 2 ? pool.slice(half) : pool.slice(0, half)
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
      for (const x of unit.extraReadings || []) x.questions.forEach(q => ex.push({ kind: 'read', title: x.title, paragraphs: x.paragraphs, paragraphsAr: x.paragraphsAr, question: q }))
      ;(r.trueFalse || []).forEach(t => ex.push({ kind: 'truefalse', statement: t.statement, answer: t.answer }))
      shuffle(readWords).slice(0, 3).forEach(w => ex.push(exChooseAr(w, pool)))
      return ex
    }
    case 'grammar': {
      const all = grammarExercises(unit.grammar, pool)
      const half = Math.ceil(all.length / 2)
      // the first grammar lesson explains the rule and drills the easier half,
      // the second drills the rest so no authored exercise goes unused
      const mine = lesson.part === 2 ? all.slice(half) : all.slice(0, half)
      const ex: Exercise[] = [{ kind: 'grammar_card', grammar: unit.grammar }]
      ex.push(...shuffle(mine).slice(0, 14))
      return ex
    }
    case 'vocabFocus': {
      const v = unit.vocabFocus
      if (!v) return []
      return [{ kind: 'grammar_card', grammar: v } as Exercise, ...shuffle(grammarExercises(v, pool)).slice(0, 16)]
    }
    case 'everyday': {
      const e = unit.everyday
      if (!e) return []
      const drills = grammarExercises({ ...unit.grammar, exercises: e.exercises }, pool)
      const ex: Exercise[] = [{ kind: 'phrase_card', everyday: e }]
      ex.push(...shuffle(drills).slice(0, 12))
      // hear and repeat the expressions themselves
      shuffle(e.expressions).slice(0, 2).forEach(x => ex.push({ kind: 'speak', text: x.en, ar: x.ar }))
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
    case 'workbook': {
      const wb = unit.workbook
      if (!wb) return []
      const all = grammarExercises({ ...unit.grammar, exercises: wb.exercises }, pool)
      const parts = workbookParts(unit)
      const cut = Math.ceil(all.length / parts)
      const ex: Exercise[] = []
      // the texts come first, in the book's order, then the exercises as the Activity Book prints them
      if (lesson.part !== 2) for (const r of wb.readings) {
        r.questions.forEach(q => ex.push({ kind: 'read', title: r.title, paragraphs: r.paragraphs, paragraphsAr: r.paragraphsAr, question: q }))
        ;(r.trueFalse || []).forEach(t => ex.push({ kind: 'truefalse', statement: t.statement, answer: t.answer }))
      }
      ex.push(...(lesson.part === 2 ? all.slice(cut) : all.slice(0, cut)))
      return ex
    }
    case 'translation': {
      const items = shuffle(unit.translations || [])
      const ex: Exercise[] = []
      const arPool = (unit.translations || []).map(t => t.ar)
      // Arabic to English with word tiles, English to Arabic by choosing, then both ways written out
      items.slice(0, 4).forEach(t => ex.push(exBuild(t.en, pool, t.ar)))
      items.slice(4, 7).forEach(t => ex.push({ kind: 'mcq', prompt: t.en, promptAr: 'اختر الترجمة الصحيحة', ...withAnswer(t.ar, shuffle(arPool.filter(a => a !== t.ar)).slice(0, 3)), explainAr: `الترجمة: ${t.ar}` }))
      items.slice(7, 9).forEach(t => ex.push({ kind: 'translate', dir: 'en2ar', source: t.en, model: t.ar }))
      items.slice(9, 11).forEach(t => ex.push({ kind: 'translate', dir: 'ar2en', source: t.ar, model: t.en }))
      return ex
    }
    case 'composition': {
      const c = unit.compositions?.[lesson.part === 2 ? 1 : 0]
      if (!c) return []
      const ex: Exercise[] = []
      // learn the language first, then rebuild sentences of the model, then write
      ex.push({ kind: 'match', pairs: shuffle(c.phrases.filter(x => x.en.split(' ').length <= 4)).slice(0, 5).map(x => ({ en: x.en, ar: x.ar })) })
      const sentences = splitSentences(c.model)
      // put the unit's phrases back into the model: the language they will need, used in context
      const short = c.phrases.filter(x => x.en.split(' ').length <= 5)
      const gaps: Exercise[] = []
      for (const ph of shuffle(short)) {
        const at = sentences.find(x => x.toLowerCase().includes(ph.en.toLowerCase()))
        if (!at) continue
        const i = at.toLowerCase().indexOf(ph.en.toLowerCase())
        const others = short.filter(o => o.en.toLowerCase() !== ph.en.toLowerCase() && !at.toLowerCase().includes(o.en.toLowerCase()))
        if (others.length < 2) continue
        gaps.push({ kind: 'fill', prompt: at.slice(0, i) + '___' + at.slice(i + ph.en.length), promptAr: `العبارة المطلوبة تعني: ${ph.ar}`, ...withAnswer(at.slice(i, i + ph.en.length), shuffle(others).slice(0, 3).map(o => o.en)), explainAr: `«${ph.en}» = ${ph.ar}. استعملها في موضوعك كما في النموذج.` })
        if (gaps.length === 3) break
      }
      ex.push(...gaps)
      const modelSentences = sentences.filter(x => { const n = x.split(' ').length; return n >= 4 && n <= 16 })
      shuffle(modelSentences).slice(0, Math.max(2, 5 - gaps.length)).forEach(x => ex.push(exBuild(x, pool)))
      ex.push({ kind: 'compose', composition: c })
      return ex.filter(e => e.kind !== 'match' || e.pairs.length >= 3)
    }
    case 'progressTest': {
      const t = module.progressTest
      if (!t) return []
      const ex: Exercise[] = []
      if (t.reading) {
        t.reading.questions.forEach(q => ex.push({ kind: 'read', title: t.reading!.title, paragraphs: t.reading!.paragraphs, paragraphsAr: t.reading!.paragraphsAr, question: q }))
        ;(t.reading.trueFalse || []).forEach(x => ex.push({ kind: 'truefalse', statement: x.statement, answer: x.answer }))
      }
      const all = module.units.flatMap(u => u.vocab)
      ex.push(...grammarExercises({ ...module.units[0].grammar, exercises: t.exercises }, all))
      return ex
    }
    case 'listening': {
      const ex: Exercise[] = []
      const words = shuffle(pool).slice(0, 6)
      words.forEach(w => ex.push(exListen(w, pool)))
      // spelling what you hear, as the exam's written answers need
      shuffle(pool.filter(w => !w.en.includes(' ') && !w.en.includes('('))).slice(0, 2).forEach(w => ex.push(exDictation(w.en, w)))
      shuffle(shortSentences(unit)).slice(0, 1).forEach(x => ex.push(exDictation(x)))
      shuffle(unit.sentences).slice(0, 3).forEach(s => ex.push(exListenSentence(s, allSentences)))
      if (unit.pronunciation) {
        // groups that continue one sound ("short /u/ (more)") are the same answer as the sound itself
        const sounds = new Map<string, string[]>()
        for (const g of unit.pronunciation.groups) {
          const base = g.label.replace(/\s*\([^)]*\)\s*$/, '').trim()
          sounds.set(base, [...(sounds.get(base) || []), ...g.words])
        }
        const labels = [...sounds.keys()]
        // a word listed under two sounds cannot be asked about
        const count = new Map<string, number>()
        for (const ws of sounds.values()) for (const w of new Set(ws)) count.set(w, (count.get(w) || 0) + 1)
        for (const [label, ws] of sounds) {
          const w = shuffle(ws.filter(x => count.get(x) === 1))[0]
          const others = labels.filter(x => x !== label)
          if (w && others.length) ex.push({ kind: 'mcq', prompt: `🔊 "${w}" — أي صوت تسمع؟`, audio: w, ...withAnswer(label, others.slice(0, 3)), explainAr: unit.pronunciation.ruleAr })
        }
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
      if (unit.vocabFocus) ex.push(...shuffle(grammarExercises(unit.vocabFocus, pool)).slice(0, 3))
      if (unit.everyday) ex.push(...shuffle(grammarExercises({ ...unit.grammar, exercises: unit.everyday.exercises }, pool)).slice(0, 2))
      shuffle(unit.reading.questions).slice(0, 2).forEach(q => ex.push({ kind: 'read', title: unit.reading.title, paragraphs: unit.reading.paragraphs, paragraphsAr: unit.reading.paragraphsAr, question: q }))
      shuffle(unit.sentences).slice(0, 2).forEach(s => ex.push(exBuild(s, pool)))
      shuffle(pool).slice(0, 2).forEach(w => ex.push(exListen(w, pool)))
      weak.slice(0, 2).forEach(w => ex.push(exType(w)))
      weak.filter(w => !w.en.includes(' ') && !w.en.includes('(')).slice(0, 1).forEach(w => ex.push(exDictation(w.en, w)))
      return shuffle(ex)
    }
    case 'boss': {
      const all = module.units.flatMap(u => u.vocab)
      const ex: Exercise[] = []
      module.units.forEach(u => {
        shuffle(u.vocab).slice(0, 3).forEach(w => ex.push(exChooseAr(w, all)))
        shuffle(u.vocab).slice(0, 2).forEach(w => ex.push(exChooseEn(w, all)))
        ex.push(...shuffle(grammarExercises(u.grammar, all)).slice(0, 3))
        if (u.vocabFocus) ex.push(...shuffle(grammarExercises(u.vocabFocus, all)).slice(0, 2))
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

/** A mock exam across every unit the learner has opened: reading, vocabulary, the taught
 *  vocabulary points, grammar and Everyday English — all drawn from the book's own content. */
export function buildMockExam(modules: Module[], unlockedUnitIds: Set<string>, size = 30): Exercise[] {
  const units = modules.flatMap(m => m.units).filter(u => unlockedUnitIds.has(u.id))
  if (units.length === 0) return []
  const words = units.flatMap(u => u.vocab)
  const pools: Exercise[][] = [[], [], [], [], []]
  for (const u of units) {
    u.reading.questions.forEach(q => pools[0].push({ kind: 'read', title: u.reading.title, paragraphs: u.reading.paragraphs, paragraphsAr: u.reading.paragraphsAr, question: q }))
    shuffle(u.vocab).slice(0, 4).forEach(w => pools[1].push(Math.random() < 0.5 ? exChooseAr(w, words) : exChooseEn(w, words)))
    if (u.vocabFocus) pools[2].push(...grammarExercises(u.vocabFocus, words).filter(e => e.kind !== 'build'))
    pools[3].push(...grammarExercises(u.grammar, words).filter(e => e.kind !== 'build'))
    if (u.everyday) pools[4].push(...grammarExercises({ ...u.grammar, exercises: u.everyday.exercises }, words).filter(e => e.kind !== 'build'))
  }
  // an exam weighs grammar and reading most; sections a book lacks give their share to grammar
  const share = [0.25, 0.2, 0.15, 0.3, 0.1]
  const out: Exercise[] = []
  share.forEach((f, i) => out.push(...shuffle(pools[i]).slice(0, Math.round(size * f))))
  if (out.length < size) out.push(...shuffle(pools[3].filter(e => !out.includes(e))).slice(0, size - out.length))
  return shuffle(out).slice(0, size)
}

/** Practice for one rule only (the unit's grammar, or its taught vocabulary point), started from the book screen. */
export function buildGrammarPractice(unit: Unit, which: 'grammar' | 'vocabFocus' | 'everyday' = 'grammar'): Exercise[] {
  if (which === 'everyday' && unit.everyday) {
    const drills = grammarExercises({ ...unit.grammar, exercises: unit.everyday.exercises }, unit.vocab)
    return [{ kind: 'phrase_card', everyday: unit.everyday }, ...shuffle(drills).slice(0, 15)]
  }
  const g = which === 'vocabFocus' && unit.vocabFocus ? unit.vocabFocus : unit.grammar
  const ex = grammarExercises(g, unit.vocab)
  return [{ kind: 'grammar_card', grammar: g } as Exercise, ...shuffle(ex).slice(0, 15)]
}

export function checkBuild(target: string, tiles: string[]): boolean {
  return normalize(tiles.join(' ')) === normalize(target)
}
/** Dictation is spelling practice, so the words must be exact; case and punctuation do not count. */
export function checkDictation(text: string, typed: string): boolean {
  const t = normalize(typed)
  return !!t && t === normalize(text)
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
