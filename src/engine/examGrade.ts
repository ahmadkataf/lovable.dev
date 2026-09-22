import type { Exam, ExamQuestion, ExamSection } from './types'

export type ExamAnswer = number | boolean | string

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'cannot'], [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'], [/'re\b/g, ' are'], [/'m\b/g, ' am'], [/'ll\b/g, ' will'], [/'ve\b/g, ' have'], [/'d\b/g, ' would'],
  [/\b(he|she|it|that|what|who|where|there|here)'s\b/g, '$1 is'],
]

/** Compare written answers the way a marker would: ignore case, punctuation, spacing and contractions. */
export function looseNorm(s: string): string {
  let t = s.toLowerCase().replace(/[’‘`]/g, "'").trim()
  for (const [re, to] of CONTRACTIONS) t = t.replace(re, to)
  return t.replace(/[.,!?;:"()«»]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function writtenIsRight(q: ExamQuestion, a: ExamAnswer | undefined): boolean {
  if (typeof a !== 'string' || !a.trim()) return false
  const t = looseNorm(a)
  return (q.accept || []).some(x => looseNorm(x) === t)
}

export function isRight(q: ExamQuestion, a: ExamAnswer | undefined): boolean {
  if (q.kind === 'write') return writtenIsRight(q, a)
  return a !== undefined && a === q.answer
}

/** Every question of a paper with the marks it is worth. */
export function examItems(exam: Exam): { q: ExamQuestion; marks: number; section: ExamSection }[] {
  const out: { q: ExamQuestion; marks: number; section: ExamSection }[] = []
  for (const s of exam.sections) {
    for (const q of s.questions || []) out.push({ q, marks: q.marks ?? s.marks / (s.questions!.length || 1), section: s })
    for (const g of s.groups || []) for (const q of g.questions) out.push({ q, marks: q.marks ?? g.marks / (g.questions.length || 1), section: s })
  }
  return out
}
