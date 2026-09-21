// ===== Content model (what the book teaches) =====

export interface Word {
  en: string
  ar: string
  pos?: string      // noun / verb / adj ...
  def?: string      // English definition
  defAr?: string    // Arabic translation of the definition
  example?: string  // example sentence (English)
  exampleAr?: string // Arabic translation of the example
}

export interface ReadingQuestion {
  q: string
  options: string[]
  answer: number      // index into options
  explainAr?: string
}

export interface Reading {
  title: string
  paragraphs: string[]
  paragraphsAr?: string[]   // Arabic translation, one per paragraph
  questions: ReadingQuestion[]
  trueFalse?: { statement: string; answer: boolean }[]
}

export interface GrammarExercise {
  type: 'mcq' | 'fill' | 'build' | 'truefalse' | 'order'
  prompt?: string        // question / sentence with ___ / instruction
  options?: string[]     // for mcq / fill
  answer: string | number | boolean  // index for mcq, text for fill/build
  extraWords?: string[]  // distractor tiles for build
  explainAr?: string
}

export interface Grammar {
  name: string
  nameAr: string
  ruleEn: string[]       // bullet points (English) verbatim / paraphrased
  ruleAr: string[]       // Arabic explanation bullets
  examples: string[]     // example sentences
  exercises: GrammarExercise[]
}

export interface Pronunciation {
  title: string
  ruleAr: string
  groups: { label: string; words: string[] }[]
}

export interface Unit {
  id: string             // 'u1'
  number: number
  module: number
  title: string
  titleAr: string
  pages: string
  emoji: string
  quotes?: { text: string; by: string }[]
  planAr: string         // short Arabic description of what the unit covers
  vocab: Word[]
  reading: Reading
  grammar: Grammar
  pronunciation?: Pronunciation
  listening?: { taskAr: string; items?: string[] }
  writing?: { taskAr: string; model?: string[]; linkers?: string[] }
  sentences: string[]    // key sentences for "build the sentence" exercises
}

/** The book's own Review section at the end of some modules. */
export interface ModuleReview {
  title: string
  titleAr: string
  pages: string
  reading?: Reading
  exercises: GrammarExercise[]
}

export interface Module {
  number: number
  title: string
  titleAr: string
  color: string
  units: Unit[]
  focus?: { title: string; paragraphs: string[]; glossary?: Word[] }
  project?: { title: string; steps: string[] }
  review?: ModuleReview
}

// ===== Exercise model (what the app shows) =====

export type Exercise =
  | { kind: 'intro'; word: Word }                                           // flashcard, tap to continue
  | { kind: 'choose_ar'; word: Word; options: string[]; answer: number }    // "what does X mean?"
  | { kind: 'choose_en'; word: Word; options: string[]; answer: number }    // "which word means (ar)?"
  | { kind: 'listen'; word: Word; options: string[]; answer: number }       // hear the word, pick it
  | { kind: 'listen_sentence'; text: string; options: string[]; answer: number } // hear sentence, pick it
  | { kind: 'type_en'; word: Word }                                         // type the English word
  | { kind: 'match'; pairs: { en: string; ar: string }[] }                  // match 5 pairs
  | { kind: 'build'; target: string; tiles: string[]; promptAr?: string }   // arrange tiles
  | { kind: 'mcq'; prompt: string; options: string[]; answer: number; explainAr?: string; audio?: string }
  | { kind: 'fill'; prompt: string; options: string[]; answer: number; explainAr?: string }
  | { kind: 'truefalse'; statement: string; answer: boolean; explainAr?: string }
  | { kind: 'read'; title: string; paragraphs: string[]; paragraphsAr?: string[]; question: ReadingQuestion }
  | { kind: 'grammar_card'; grammar: Grammar }                              // explanation screen
  | { kind: 'speak'; text: string; ar?: string }                            // listen & repeat

export type LessonKind = 'vocab' | 'reading' | 'grammar' | 'listening' | 'writing' | 'review' | 'boss' | 'bookReview'

export interface Lesson {
  id: string          // 'u1-l1'
  unitId: string
  index: number
  kind: LessonKind
  title: string       // Arabic
  icon: string
  xp: number
}
