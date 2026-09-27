// Placeholder until the Student's Book content of units 3–4 is written (see DATA_SPEC.md).
import type { Module } from '../../engine/types'
import { withExtras } from './extras/merge'
import { extras } from './extras/module2'

const base = {
  number: 2, title: '', titleAr: '', color: '',
  units: [
    { id: 'u3', number: 3, module: 2, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
    { id: 'u4', number: 4, module: 2, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
  ],
} as unknown as Module

export const module2: Module = withExtras(base, extras)
