import type { Exam } from '../../../engine/types'
import { term1A } from './term1-a'
import { term1B } from './term1-b'
import { term1C } from './term1-c'
import { term1E } from './term1-e'
import { term1F } from './term1-f'
import { term2A } from './term2-a'
import { term2B } from './term2-b'
import { term2D } from './term2-d'
import { term2E } from './term2-e'

// Term 1 covers Modules 1–3 (Units 1–6); Term 2 covers Modules 4–6 (Units 7–12).
// Test A of Term 1 is a real past paper; the others follow its layout exactly.
export const exams: Exam[] = [term1A, term1B, term1C, term1E, term1F, term2A, term2B, term2D, term2E]
