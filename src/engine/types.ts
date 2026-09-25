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
  qAr?: string        // Arabic translation of the question
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
  promptAr?: string      // Arabic translation of that sentence, keeping the blank
  promptArFull?: string  // Arabic translation once the blank is filled correctly
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

/** "Everyday English": functional expressions and the dialogue that uses them. */
export interface Expression { en: string; ar: string; note?: string }
export interface DialogueLine { speaker: string; en: string; ar: string }
export interface Everyday {
  title: string          // e.g. "Starting and finishing conversations"
  titleAr: string
  explainAr: string      // when and how these expressions are used
  expressions: Expression[]
  dialogue?: DialogueLine[]
  exercises: GrammarExercise[]
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
  vocabFocus?: Grammar   // a taught vocabulary point with its own rule and exercises (e.g. verb + preposition)
  everyday?: Everyday    // "Everyday English" section
  extraReadings?: Reading[]  // other texts the unit asks students to read (speaking/writing extracts)
  workbook?: Workbook        // the Activity Book pages for this unit
  compositions?: Composition[]   // the unit's writing tasks, taught step by step with a model answer
  translations?: TranslationItem[]  // book sentences to translate both ways, as the exam's translation task does
  /** A unit whose content stays on the server until the app is activated: only its lesson list is known. */
  outline?: { lessons: Omit<Lesson, 'unitId'>[]; vocab: number }
}

/** The Activity Book (Workbook) pages of a unit: its texts and every exercise it prints, solved. */
export interface Workbook {
  pages: string
  readings: Reading[]
  exercises: GrammarExercise[]
}

/** A writing task taught step by step: what to say, useful language from the unit, a model, a checklist. */
export interface Composition {
  source: 'book' | 'workbook'
  topic: string              // the task as printed
  topicAr: string
  words: number              // the length the task asks for
  points?: string[]          // what the task says to include, as printed
  pointsAr?: string[]
  plan: { en: string; ar: string }[]      // what each part of the answer says, in order
  phrases: { en: string; ar: string }[]   // words and sentences from the unit to use
  model: string
  modelAr: string
  checklistAr: string[]
}

export interface TranslationItem { en: string; ar: string }

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
  progressTest?: ModuleReview   // the Activity Book's Progress Test
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
  | { kind: 'mcq'; prompt: string; promptAr?: string; options: string[]; answer: number; explainAr?: string; audio?: string }
  | { kind: 'fill'; prompt: string; promptAr?: string; promptArFull?: string; options: string[]; answer: number; explainAr?: string }
  | { kind: 'truefalse'; statement: string; statementAr?: string; answer: boolean; explainAr?: string }
  | { kind: 'read'; title: string; paragraphs: string[]; paragraphsAr?: string[]; question: ReadingQuestion }
  | { kind: 'grammar_card'; grammar: Grammar }                              // explanation screen
  | { kind: 'speak'; text: string; ar?: string }                            // listen & repeat
  | { kind: 'phrase_card'; everyday: Everyday }                             // everyday-English expressions and dialogue
  | { kind: 'dictation'; text: string; word?: Word }                        // hear it, spell it
  | { kind: 'translate'; dir: 'ar2en' | 'en2ar'; source: string; model: string }  // write a translation, then compare with the model
  | { kind: 'compose'; composition: Composition }                           // write a composition, then compare and self-assess

export type LessonKind = 'vocab' | 'reading' | 'vocabFocus' | 'grammar' | 'listening' | 'everyday' | 'writing' | 'review' | 'boss' | 'bookReview' | 'workbook' | 'translation' | 'composition' | 'progressTest'

export interface Lesson {
  id: string          // 'u1-l1'
  unitId: string
  index: number
  kind: LessonKind
  title: string       // Arabic
  icon: string
  xp: number
  part?: number       // 1 or 2 for lessons that split one section in two
}

// ===== Final-exam papers =====

/** One question of an exam paper, numbered as printed.
 *  `ask` and `wrongpart` mark the underlined parts of `prompt` with {braces}:
 *  - ask:       "{Kindergarten} is a school for little children."  → options are candidate questions
 *  - wrongpart: "Huda {told} {hers} mother that {she} {felt} ill." → the parts are a, b, c, d in order
 *  `write` is answered in the learner's own words (Bac papers): answers that match `accept`
 *  (loosely: case, punctuation and contractions ignored) count automatically; otherwise the learner
 *  compares with `model` and may credit an answer that says the same thing. */
export interface ExamQuestion {
  n: number
  kind: 'mcq' | 'truefalse' | 'ask' | 'wrongpart' | 'write'
  prompt: string
  promptAr?: string
  options?: string[]          // mcq and ask
  answer?: number | boolean   // option / part index, or true/false (not used by write)
  accept?: string[]           // write: answers that count as right automatically
  model?: string              // write: the model answer shown after hand-in (defaults to accept[0])
  modelAr?: string
  lines?: number              // write: height of the answer box
  marks?: number              // overrides the even split of its group or section
  explainAr: string           // why that answer is right, shown after the paper is handed in
  topic?: 'tense' | 'reported' | 'conditional' | 'grammar' | 'pronunciation' | 'vocab' | 'wordform'  // what the item tests
}

/** A task inside a section with its own printed instruction and marks
 *  (a Bac reading passage is followed by several such tasks). */
export interface ExamGroup {
  title: string
  titleAr: string
  marks: number
  questions: ExamQuestion[]
}

export interface ExamSection {
  letter: string              // 'A'…'F' on Grade 8 papers, 'A', 'B', 'III'…'X' on Bac papers
  title: string               // the instruction as printed
  titleAr: string
  marks: number
  passage?: { paragraphs: string[]; paragraphsAr: string[] }   // {braces} mark words the paper underlines
  questions?: ExamQuestion[]
  groups?: ExamGroup[]
  writing?: {
    topic: string
    topicAr: string
    words: number             // e.g. 50, or 80 on Bac papers
    points?: string[]         // what the composition must include, as printed
    model: string             // a model answer the learner compares with
    modelAr: string
    checklistAr: string[]     // what a full-mark paragraph does, for self-assessment
  }
}

export interface Exam {
  id: string                  // 't1-a'
  term: 1 | 2
  title: string               // "Term 1 — Test A"
  titleAr: string
  grade?: string              // printed in the paper's header, e.g. '8'
  termAr?: string             // heading of this paper's group on the exams screen, e.g. 'الفصل الأول'
  scopeAr?: string            // what the paper covers, e.g. 'الوحدات 1–6'
  label?: string              // printed in the header instead of 'TERM n', e.g. 'BACCALAUREATE'
  minutes: number
  totalMarks: number
  real?: boolean              // a past paper typed in as printed
  sourceAr?: string           // where it comes from / what it covers
  sections: ExamSection[]
}

/** A textbook the app is built for. One build of the app carries one book. */
export interface BookMeta {
  id: string            // 'g8', 'g11'
  title: string         // shown in the header, e.g. "Emar 8"
  titleAr: string
  subtitle: string      // e.g. "Grade 8 · Student's Book"
  storageKey: string    // localStorage key for progress
  appName: string       // Android app name
  packageId: string     // Android package id
  iconText: string      // text drawn on the launcher icon
  color: string         // theme colour
}
