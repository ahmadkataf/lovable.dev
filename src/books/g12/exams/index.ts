import type { Exam } from '../../../engine/types'
import { term1A } from './term1-a'
import { term1B } from './term1-b'
import { term1C } from './term1-c'
import { term1D } from './term1-d'
import { term1E } from './term1-e'
import { term1F } from './term1-f'

// Term 1 papers cover Modules 1–3 (Units 1–6), as the school's Term 1 exam does.
// "Term 2" here is the national Baccalaureate exam, which covers the whole book (Units 1–12).
// Test A of Term 1 is a real past paper; the others follow its layout exactly.
const papers: Exam[] = [term1A, term1B, term1C, term1D, term1E, term1F]
const scope: Record<1 | 2, Pick<Exam, 'termAr' | 'scopeAr' | 'label'>> = {
  1: { termAr: 'الفصل الأول', scopeAr: 'الوحدات 1–6' },
  2: { termAr: 'نماذج البكالوريا النهائية', scopeAr: 'الكتاب كاملاً: الوحدات 1–12', label: 'BACCALAUREATE' },
}
export const exams: Exam[] = papers.map(e => ({ grade: '12', ...scope[e.term], ...e }))
