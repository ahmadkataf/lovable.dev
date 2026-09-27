// Placeholder until the Student's Book content of units 9–10 is written (see DATA_SPEC.md).
import type { Module } from '../../engine/types'
import { withExtras } from './extras/merge'
import { extras } from './extras/module5'

const base = {
  number: 5, title: '', titleAr: '', color: '',
  units: [
    { id: 'u9', number: 9, module: 5, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
    { id: 'u10', number: 10, module: 5, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
  ],
} as unknown as Module

export const module5: Module = withExtras(base, extras)
