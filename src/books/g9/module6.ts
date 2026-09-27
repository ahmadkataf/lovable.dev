// Placeholder until the Student's Book content of units 11–12 is written (see DATA_SPEC.md).
import type { Module } from '../../engine/types'
import { withExtras } from './extras/merge'
import { extras } from './extras/module6'

const base = {
  number: 6, title: '', titleAr: '', color: '',
  units: [
    { id: 'u11', number: 11, module: 6, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
    { id: 'u12', number: 12, module: 6, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
  ],
} as unknown as Module

export const module6: Module = withExtras(base, extras)
