import type { Exam } from '../../../engine/types'
import { term1A } from './term1-a'

// Term 1 papers cover Modules 1–3 (Units 1–6), as the school's Term 1 exam does.
// "Term 2" here is the national Baccalaureate exam, which covers the whole book (Units 1–12).
// Test A of Term 1 is a real past paper; the others follow its layout exactly.
const papers: Exam[] = [term1A]
const scope: Record<1 | 2, Pick<Exam, 'termAr' | 'scopeAr'>> = {
  1: { termAr: 'الفصل الأول', scopeAr: 'الوحدات 1–6' },
  2: { termAr: 'نماذج البكالوريا النهائية', scopeAr: 'الكتاب كاملاً: الوحدات 1–12' },
}
export const exams: Exam[] = papers.map(e => ({ grade: '12 · Scientific', ...scope[e.term], ...e }))
