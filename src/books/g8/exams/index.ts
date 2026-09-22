import type { Exam } from '../../../engine/types'
import { term1A } from './term1-a'
import { term1B } from './term1-b'
import { term1C } from './term1-c'
import { term1D } from './term1-d'
import { term1E } from './term1-e'
import { term1F } from './term1-f'
import { term2A } from './term2-a'
import { term2B } from './term2-b'
import { term2C } from './term2-c'
import { term2D } from './term2-d'
import { term2E } from './term2-e'
import { term2F } from './term2-f'

// Term 1 covers Modules 1–3 (Units 1–6); Term 2 covers Modules 4–6 (Units 7–12).
// Test A of Term 1 is a real past paper; the others follow its layout exactly.
const papers: Exam[] = [term1A, term1B, term1C, term1D, term1E, term1F, term2A, term2B, term2C, term2D, term2E, term2F]
export const exams: Exam[] = papers.map(e => ({ grade: '8', ...e }))
