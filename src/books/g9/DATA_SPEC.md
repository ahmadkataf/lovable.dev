# Authoring spec — English, Grade 9 (Syria), Student's Book + Activity Book

The app turns this textbook into a Duolingo-style course for Syrian students in Grade 9, the year of the national
Basic Education Certificate exam (شهادة التعليم الأساسي). They are native Arabic speakers and often weak in English.
The teacher's hard rules:

1. **Never leave the curriculum.** Every word, text, rule, dialogue and sentence comes from the book's own pages.
   The verbatim text of the pages is in `book-source/g9/moduleN.md` (Student's Book) and
   `book-source/g9/workbook-moduleN.md` (Activity Book). The text layer can scramble columns and boxes:
   **look at the page images** (paths in your task) to read each page correctly.
2. **The student must understand everything in Arabic**: every definition, example, paragraph, question,
   exercise sentence and dialogue line carries an Arabic translation.
3. **Exam readiness**: every exercise the book prints is in the app, solved; extra practice drills the same
   rule inside the same unit's world (its vocabulary, people, places, topics) — nothing from outside.

Types: `src/engine/types.ts` (Module, Unit, Word, Reading, Grammar, GrammarExercise, Everyday, ModuleReview).
Export one object per file: `const base: Module = { ... }` then `export const moduleN: Module = withExtras(base, extras)`
(imports: types from `'../../engine/types'`, `withExtras` from `'./extras/merge'`, `extras` from `'./extras/moduleN'`).

## Book layout
6 modules × 2 units (ids `u1`…`u12`). Each unit: Speaking, Reading, Vocabulary, Grammar, Pronunciation, Listening,
Writing; units end with "Focus on" (cross-curricular) pages, a project or a story. Module 3 ends with Review 1
(Student's Book pp. 38–40) and the Activity Book's Progress Test 1 (pp. 27–31); Module 6 ends with Review 2
(Student's Book pp. 79–80) and Progress Test 2 (Activity Book pp. 61–64).
| Module | Student's Book pages | Activity Book pages |
|---|---|---|
| 1 Make a Difference (u1 Work Together to Make it Better, u2 Creativity & Initiatives) | 3–14 | 3–10 |
| 2 The Future World (u3 A More Comfortable Life, u4 Transport and Tourism) | 15–26 | 11–18 |
| 3 Decision Making (u5 Make Up Your Mind, u6 Exciting Challenge) + Review 1 | 27–40 | 19–31 |
| 4 On the Edge (u7 Critical Moments, u8 At Risk) | 41–54 | 32–41 |
| 5 Values & Time (u9 Stay Positive, u10 Time Waits for No One) | 55–65 | 42–50 |
| 6 Keep in Touch (u11 Ready to Contact?, u12 Silent, yet Talking!) + Review 2 | 66–80 | 51–64 |
Find where each unit starts from the page headings/images.

## Per unit (`units: [ {...}, {...} ]`, ids `u1`…`u12`)
- `id`, `number`, `module`, `title` (as printed), `titleAr`, `pages` ("7–15"), `emoji`, `planAr` (what the unit teaches, from its Preview box).
- `vocab` — **30–45 words**. Take them from: the unit's vocabulary/matching exercises (their printed meanings are the `def`),
  bold/glossed words, and the important words of the reading text. Base forms, no duplicates.
  Every word: `en`, `ar`, `pos`, `def` (the book's meaning when printed, else a simple one), `defAr`.
  `example` + `exampleAr`: **only** a complete sentence printed in this unit's pages (reading, exercise items —
  an exercise sentence with its blank or bracket choice correctly resolved is allowed). Never invent one; if the
  word appears in no sentence, leave `example` out.
- `reading` — the unit's main reading text, **verbatim and complete**, one string per paragraph; `paragraphsAr`
  (one Arabic translation per paragraph); `questions`: **6–8** four-option MCQs (`q`, `qAr`, `options`, `answer` index,
  `explainAr`) — the book's own comprehension/matching items first (converted to MCQ), answers supported by the text;
  `trueFalse`: 3–5 statements from the text.
- `extraReadings` — any other passage the unit prints (speaking/writing/listening extracts, model texts): verbatim,
  with `paragraphsAr` and 2–4 questions (with `qAr`).
- `vocabFocus` — the unit's **Vocabulary** section (e.g. "Verb + preposition", "Make and Do", "Phrasal verbs",
  "Word families") as a `Grammar` object: `name`, `nameAr`, `ruleEn` (the book's explanation, close to verbatim),
  `ruleAr` (simple Arabic), `examples` (the book's example sentences), `exercises` **18–25**: every item of the
  book's vocabulary exercises, solved, then more items on the same words.
- `grammar` — the unit's **Grammar** section: `ruleEn` (the book's rule boxes), `ruleAr`, `examples` (from the book),
  `exercises` **32–36**: EVERY item the book prints for this grammar point (solved), then your own items drilling
  the same rule inside the unit's world, easy → hard. Mix `fill` (~50%), `mcq` (~25%), `build`, `truefalse`.
- `pronunciation` — `title` (as printed, with the IPA symbols), `ruleAr`, `groups`: one per sound, `label` like
  "/θ/ — thigh", `words`: the book's words for that sound (including the classification exercise, solved).
- `everyday` — the **Everyday English** section: `title` (as printed), `titleAr`, `explainAr` (when we use these
  expressions), `expressions` (every expression the book lists: `en` verbatim, `ar`, optional `note`),
  `dialogue` (the book's dialogue lines verbatim: `speaker`, `en`, `ar`), `exercises` **10–15** (choose the right
  expression for a situation, complete the dialogue, etc. — built only from these expressions).
- `listening` — `taskAr` + `items` (the book's task items). The audio script is not in the book: never make an
  exercise whose answer depends on the recording.
- `writing` — `taskAr` (the book's writing task in Arabic), `model` (any model text the book prints, verbatim),
  `linkers` (connectors the book teaches).
- `sentences` — **12–16** sentences copied from this unit's pages (reading or solved exercise items), 5–14 words
  each, complete and grammatical. Used for "build the sentence" and listening practice.

## Every exercise (`GrammarExercise`)
- `fill`: `prompt` with `___`, 3–4 `options`, `answer` = 0-based index, `explainAr` (why, naming the rule),
  `promptAr` (Arabic with the blank kept as `___` so it does not reveal the answer),
  `promptArFull` (the Arabic sentence completed correctly — conjugate properly, no `___`).
- `mcq`: `prompt`, 3–4 `options`, `answer` index, `explainAr`, `promptAr`.
- `truefalse`: `prompt` (a statement), `answer` boolean, `promptAr`, `explainAr`.
- `build`: `answer` = a correct English sentence (4–12 words), `prompt` = an Arabic hint.
- Options are distinct, plausible (typical learner mistakes), exactly one correct.

## Module level
- `number`, `title`, `titleAr`, `color` (1 `#58cc02`, 2 `#1cb0f6`, 3 `#ce82ff`, 4 `#ff9600`, 5 `#ff4b4b`, 6 `#2b70c9`).
- `review` (modules 3 and 6 — the book's Review 1/2): `title`, `titleAr`, `pages`, `reading` if the review has a text,
  `exercises` **30–40**: every item printed in the Review (solved) plus items mixing the rules of the two modules it covers.
- `project` (when a unit or module prints one): `title` and `steps` — the book's project text, verbatim.

## Checking
`node scripts/check-book.mjs g9 N` must print `OK`. It verifies counts, answer indexes, distinct options, every Arabic
field, and that every example, reading paragraph, dialogue line and sentence exists in `book-source/g9/moduleN.md`.


## Grade 9 specifics — the national exam year
The students sit the Basic Education Certificate exam on this book: a reading passage with comprehension
questions (true/false with correction, answer the questions, find words that mean, MCQ), vocabulary, grammar
(every structure the book teaches: tenses, will/going to, determiners, imperatives, past perfect, wish,
relative clauses, reported questions, passive, possessive and reflexive pronouns, question tags…),
pronunciation (the book's sounds), and a paragraph of about 80 words. Make the grammar and vocabulary drills
cover every form the book teaches, and give every exercise a clear Arabic explanation a weak student can learn from.
If a unit genuinely has no Everyday English or Pronunciation section, leave that field out instead of inventing one.

## The Activity Book (Workbook) and exam skills — per unit
The Activity Book's verbatim text is in `book-source/g9/workbook-moduleN.md`.
Add to each unit:
- `workbook: { pages, readings, exercises }`
  - `pages`: the Activity Book pages of the unit, e.g. "2–8".
  - `readings`: every text the unit's Activity Book pages print (verbatim, complete, one string per paragraph),
    each with `paragraphsAr`, 3–6 questions (`q`, `qAr`, four `options`, `answer`, `explainAr`; the book's own
    comprehension items first, converted to MCQ) and `trueFalse` where the book asks for it.
  - `exercises`: EVERY item the unit's Activity Book pages print (vocabulary, grammar, pronunciation, everyday
    English, "rewrite", "correct the mistakes", "put the verbs in the right form"…), solved, in the book's order,
    as `fill`/`mcq`/`truefalse`/`build` GrammarExercises with full Arabic (`promptAr`, `promptArFull`, `explainAr`).
    At least 20. Items that need a recording are left out; open speaking/discussion items are left out.
- `compositions`: the unit's writing tasks — first the Student's Book writing task (`source: 'book'`), then the
  Activity Book writing task (`source: 'workbook'`) — each:
  `topic` (the task as printed), `topicAr`, `words` (the length it asks for; 100 if none), `points`/`pointsAr`
  (the printed prompts/questions to include, if any), `plan` (3–5 steps: what each part of the answer says, en + ar),
  `phrases` (8–14 useful words, phrases and linkers FROM THE UNIT with Arabic — the unit's vocabulary, idioms,
  grammar structures), `model` (a model answer at the required length, simple correct English a strong Grade 9
  student could write, using the phrases), `modelAr`, `checklistAr` (5–6 points a marker checks).
- `translations`: 14–18 sentences copied from the unit's pages (Student's Book or Activity Book), 6–16 words,
  complete and grammatical, each with a natural Arabic translation `ar` — like the exam's translation task.
Module level (modules 3 and 6): `progressTest` = the Activity Book's Progress Test (`title`, `titleAr`, `pages`,
`reading` if it has a text, `exercises`: every item solved, at least 20).
Checker: `node scripts/check-book.mjs g9 N` verifies all of this against both books' text.
