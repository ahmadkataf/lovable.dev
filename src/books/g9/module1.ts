// Placeholder until the Student's Book content of units 1–2 is written (see DATA_SPEC.md).
import type { Module } from '../../engine/types'
import { withExtras } from './extras/merge'
import { extras } from './extras/module1'

const base = {
  number: 1, title: '', titleAr: '', color: '',
  units: [
    { id: 'u1', number: 1, module: 1, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
    { id: 'u2', number: 2, module: 1, title: '', titleAr: '', pages: '', emoji: '', planAr: '', vocab: [], sentences: [], reading: { title: '', paragraphs: [], paragraphsAr: [], questions: [] }, grammar: { name: '', nameAr: '', ruleEn: [], ruleAr: [], examples: [], exercises: [] } },
  ],
} as unknown as Module

export const module1: Module = withExtras(base, extras)
