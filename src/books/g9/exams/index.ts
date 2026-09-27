import type { Exam } from '../../../engine/types'
import { term2A } from './term2-a'
import { term2B } from './term2-b'
import { term2C } from './term2-c'
import { term2D } from './term2-d'
import { term2E } from './term2-e'
import { term2F } from './term2-f'

// The Basic Education Certificate exam covers the whole book. Paper A is the real 2026 paper;
// the others follow its layout exactly (A–G, 400 marks, 90 minutes), with passages and sentences from the book.
const papers: Exam[] = [term2A, term2B, term2C, term2D, term2E, term2F]
export const exams: Exam[] = papers.map(e => ({ grade: '9', termAr: 'نماذج امتحان شهادة التعليم الأساسي', scopeAr: 'الكتاب كاملاً: الوحدات 1–12', label: 'CERTIFICATE', ...e }))
