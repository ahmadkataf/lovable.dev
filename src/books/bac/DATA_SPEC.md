# Authoring spec — Emar English Series, Scientific Section (Syrian Bac)

The app turns this textbook into a Duolingo-style course for Syrian students preparing for the Bac exam.
They are native Arabic speakers and often weak in English. The teacher's hard rules:

1. **Never leave the curriculum.** Every word, text, rule, dialogue and sentence comes from the book's own pages.
   The verbatim text of the pages is in `book-source/bac/moduleN.md`; the page images are listed in your task.
2. **The student must understand everything in Arabic**: every definition, example, paragraph, question,
   exercise sentence and dialogue line carries an Arabic translation.
3. **Exam readiness**: every exercise the book prints is in the app, solved; extra practice drills the same
   rule inside the same unit's world (its vocabulary, people, places, topics) — nothing from outside.

Types: `src/engine/types.ts` (Module, Unit, Word, Reading, Grammar, GrammarExercise, Everyday, ModuleReview).
Export one object per file: `export const moduleN: Module = { ... }`, import types from `'../../engine/types'`.

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
- `review` (modules 2, 4, 6 — the book's Review 1/2/3): `title`, `titleAr`, `pages`, `reading` if the review has a text,
  `exercises` **30–40**: every item printed in the Review (solved) plus items mixing the rules of the two modules it covers.
- `project` (modules 2, 4, 6): `title` and `steps` — the book's project text, verbatim.

## Checking
`node scripts/check-book.mjs bac N` must print `OK`. It verifies counts, answer indexes, distinct options, every Arabic
field, and that every example, reading paragraph, dialogue line and sentence exists in `book-source/bac/moduleN.md`.
