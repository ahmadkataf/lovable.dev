// Placeholder until the Student's Book content of units 7–8 is written (see DATA_SPEC.md).
import type { Module } from '../../engine/types'
import { withExtras } from './extras/merge'
import { extras } from './extras/module4'

const base = {
  number: 4, title: '', titleAr: '', color: '',
  units: [
    { id: 'u7', number: 7, module: 4, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
    { id: 'u8', number: 8, module: 4, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
  ],
} as unknown as Module

export const module4: Module = withExtras(base, extras)
