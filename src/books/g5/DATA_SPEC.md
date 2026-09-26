# Authoring spec — English, Grade Five (Syria), Pupil's Book + Activity Book

The app turns this textbook into a Duolingo-style course for Syrian pupils in Grade 5 (about 10 years old).
They are native Arabic speakers and beginners in English. The teacher's hard rules:

1. **Never leave the curriculum.** Every word, text, rule, dialogue and sentence comes from the book's own pages.
   The verbatim text of the pages is in `book-source/g5/moduleN.md` (Pupil's Book) and
   `book-source/g5/workbook-moduleN.md` (Activity Book). The text layer sometimes mixes the order of columns and
   bubbles: **look at the page images** (paths given in your task) to read each page correctly.
2. **The pupil must understand everything in Arabic**: every word, definition, example, paragraph, question,
   exercise sentence and dialogue line carries an Arabic translation. Arabic is simple, clear and friendly —
   written for a 10-year-old (short sentences, everyday words, no grammar jargon without a simple explanation).
3. **Exam readiness**: every exercise the book prints is in the app, solved; extra practice drills the same
   rule inside the same unit's world (its words, people, places, topics) — nothing from outside.

Types: `src/engine/types.ts` (Module, Unit, Word, Reading, Grammar, GrammarExercise, Everyday, ModuleReview,
Workbook, Composition, TranslationItem). Import types from `'../../engine/types'` (from `extras/`: `'../../../engine/types'`).

## Book layout
20 units, 3 pages each in both books, grouped into 4 modules of 5 units; each module ends with the book's Revision.
| Module | Units | Pupil's Book pages | Activity Book pages |
|---|---|---|---|
| 1 | 1 At School · 2 Family · 3 Daily Routines · 4 The Five Senses · 5 Clothes | 3–17, Revision 1: 18–20 | 5–19, Revision 1: 20–21 |
| 2 | 6 Healthy Lifestyle · 7 Hobbies · 8 Inventions · 9 Music · 10 Technology | 21–35, Revision 2: 36–38 (with the song) | 22–36, Revision 2: 37–38 |
| 3 | 11 Nature · 12 Jobs · 13 Houses · 14 At the Sports Centre · 15 Sports Equipment | 39–53, Revision 3: 54–55 | 39–53, Revision 3: 54–55 |
| 4 | 16 Food and Drinks · 17 Farming · 18 At the Airport · 19 Festivals · 20 Places Around | 56–70, Revision 4: 71–72 | 56–70, Revision 4: 71–72 |

## Pupil's Book — `src/books/g5/moduleN.ts`
`export const moduleN: Module = withExtras(base, extras)` where `const base: Module = { ... }` and
`import { withExtras } from './extras/merge'`, `import { extras } from './extras/moduleN'`.
Module: `number`, `title` ("Units 1–5"), `titleAr` ("الوحدات ١–٥: …" with the unit topics), `color`
(1 `#58cc02`, 2 `#1cb0f6`, 3 `#ce82ff`, 4 `#ff9600`), `units` (5), `review`.

Per unit (ids `u1`…`u20`, `module` = N):
- `id`, `number`, `module`, `title` (as printed), `titleAr`, `pages` ("3–5"), `emoji`, `planAr` (one or two
  sentences: what the unit teaches — words, grammar, sound).
- `vocab` — **15–25 words** from the unit's pages: picture words, the listening/matching words, the key words of
  the reading text and exercises. Base forms, no duplicates. Every word: `en`, `ar`, `pos`, `def` (a very simple
  English meaning), `defAr`. `example` + `exampleAr`: **only** a complete sentence printed in this unit's Pupil's
  Book pages (an exercise sentence with its blank or bracket choice correctly resolved is allowed). Never invent
  one; if the word appears in no full sentence, leave `example` out.
- `reading` — the unit's reading text ("Read and …"), **verbatim and complete**, one string per paragraph (a
  dialogue text: one string per line, e.g. "Lama: What is your favourite hobby, Adam?"); `paragraphsAr`;
  `questions`: **4–6** four-option MCQs (`q`, `qAr`, `options`, `answer` index, `explainAr`) — the book's own
  tasks first (true/false, fill the chart, answer, match — converted to MCQ); `trueFalse`: 2–4 statements
  (the book's own T/F items first). The text must be at least 30 words.
- `extraReadings` — any other passage of 30+ words the unit prints (a second text, a model paragraph): verbatim,
  `paragraphsAr`, 2–3 questions.
- `grammar` — the unit's grammar box: `name`, `nameAr`, `ruleEn` (the box, close to verbatim), `ruleAr` (simple
  Arabic, with a tip on how to choose), `examples` (the book's example sentences), `exercises` **20–26**: EVERY
  item the book prints for this grammar point (solved), then your own items drilling the same rule with the
  unit's words, easy → hard. Mix `fill` (~50%), `mcq` (~25%), `build`, `truefalse`.
- `vocabFocus` — when the unit teaches a word point (word families like invent/invention/inventor, plurals,
  telling the time, adjectives → adverbs, much/many…), as a `Grammar` object with **10–15** exercises.
  Leave it out if the unit has none.
- `pronunciation` — when printed (e.g. Silent "h"): `title` as printed, `ruleAr` (simple), `groups`
  (`label`, `words` — the book's words). Leave it out if the unit has none.
- `everyday` — the unit's speaking bubbles / "Practise with a partner" / "Ask and answer" language:
  `title`, `titleAr`, `explainAr`, `expressions` (**at least 4**, verbatim from the page, `ar`), `dialogue` when the
  page prints one (`speaker`, `en` verbatim, `ar`), `exercises` **6–10** built only from these expressions.
  Leave it out if the unit prints fewer than 4 such expressions.
- `listening` — `taskAr` + `items` (the printed options). The audio script is not in the book: never make an
  exercise whose answer depends on the recording.
- `writing` — `taskAr` (the unit's writing task in Arabic).
- `sentences` — **10–14** complete sentences copied from this unit's Pupil's Book pages, 3–12 words, for
  "build the sentence" and listening.

## Activity Book — `src/books/g5/extras/moduleN.ts`
`export const extras: ModuleExtras = { units: { u1: {...}, ... }, progressTest }`
(`import type { ModuleExtras } from './merge'`). Per unit:
- `workbook: { pages, readings, exercises }`
  - `pages`: the unit's Activity Book pages, e.g. "5–7".
  - `readings`: every text of 30+ words the unit's Activity Book pages print (verbatim, complete), each with
    `paragraphsAr`, 2–4 questions (the book's own tasks first, as MCQ) and `trueFalse` where the book asks for it.
  - `exercises`: EVERY item the unit's Activity Book pages print (fill in the spaces, choose, match, reorder,
    correct the mistake, write the plural, classify…), solved, in the book's order, as `fill`/`mcq`/`truefalse`/
    `build` exercises with full Arabic. **At least 12.** Items that need the recording, a drawing or colouring,
    or an open personal answer are left out (or turned into a solvable item using the page's own words).
- `compositions`: the unit's writing tasks — first the Pupil's Book one (`source: 'book'`), then the Activity
  Book one (`source: 'workbook'`): `topic` (the task exactly as printed), `topicAr`, `words` (40 if the task does
  not say), `points`/`pointsAr` if printed, `plan` (2–4 steps, en + ar), `phrases` (**5–10** words/phrases from the
  unit with Arabic), `model` (30–60 words, simple correct English a good Grade 5 pupil could write, using the
  unit's words and grammar), `modelAr`, `checklistAr` (4–5 points).
- `translations`: **6–10** short sentences copied from the unit's pages (either book), 4–12 words, with a natural
  Arabic translation `ar`.
Module level: `progressTest` = the Activity Book's Revision (`title` "Revision N", `titleAr`, `pages`, `reading`
if it prints a text, `exercises`: every item solved, **at least 12**).

## Every exercise (`GrammarExercise`)
- `fill`: `prompt` with `___`, 3–4 `options`, `answer` = 0-based index, `explainAr` (why, in simple words),
  `promptAr` (Arabic with the blank kept as `___` so it does not reveal the answer),
  `promptArFull` (the Arabic sentence completed correctly, no `___`).
- `mcq`: `prompt`, 3–4 `options`, `answer` index, `explainAr`, `promptAr`.
- `truefalse`: `prompt` (a statement), `answer` boolean, `promptAr`, `explainAr`.
- `build`: `answer` = a correct English sentence (3–12 words), `prompt` = an Arabic hint (its translation).
- Options are distinct, plausible (typical beginner mistakes), exactly one correct.

## Module review (Pupil's Book Revision)
`review`: `title` ("Revision 1"), `titleAr`, `pages`, `reading` if the revision prints a text of 30+ words,
`exercises` **20–30**: every item printed in the Revision (solved) plus items mixing the module's grammar.

## Checking
`node scripts/check-book.mjs g5 N` must print `OK`. It verifies counts, answer indexes, distinct options, every
Arabic field, and that every example, reading paragraph, dialogue line, sentence and translation exists in the
book text. Fix every problem it lists; never weaken a check.
