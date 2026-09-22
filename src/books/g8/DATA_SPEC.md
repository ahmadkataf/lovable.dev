# Data authoring spec for `src/data/moduleN.ts`

Each module file exports ONE `Module` object (types in `src/engine/types.ts`). Example skeleton:

```ts
import type { Module } from '../engine/types'

export const module1: Module = {
  number: 1,
  title: 'Schooldays',
  titleAr: 'أيام المدرسة',
  color: '#58cc02',
  units: [
    {
      id: 'u1', number: 1, module: 1,
      title: 'Future Plans', titleAr: 'خطط المستقبل', pages: '6–11', emoji: '🏫',
      quotes: [{ text: 'Education is the most powerful weapon you can use to change the world.', by: 'Nelson Mandela' }],
      planAr: 'قراءة عن المدارس في الماضي والحاضر والمستقبل، مراجعة الأزمنة، ومفردات التعليم والتكنولوجيا.',
      vocab: [
        { en: 'provide', ar: 'يزوّد / يوفّر', pos: 'verb', def: 'to give something to be used', example: "Schools weren't provided with technological innovations." },
        { en: 'innovation', ar: 'ابتكار', pos: 'noun', def: 'ideas or ways of doing new things', example: 'the speed of technological innovations' },
        // ... 30–40 words per unit
      ],
      reading: {
        title: 'Schools in the Past, Present and Future',
        paragraphs: [ 'In the past and about 30 years ago, ...', '...' ],   // FULL verbatim text, one string per paragraph
        questions: [
          { q: 'Why does a future school combine high-quality education with new technologies?',
            options: ['To convey useful and practical knowledge', 'To replace teachers with robots', 'To make exams harder', 'To save money'],
            answer: 0, explainAr: 'النص يقول: in order to convey useful and practical knowledge.' },
          // 5–8 questions. Convert open questions from the book into 4-option MCQs whose correct answer comes from the text.
        ],
        trueFalse: [ { statement: 'There were computers in schools 30 years ago.', answer: false } ], // 2–5 items
      },
      grammar: {
        name: 'Revision of tenses', nameAr: 'مراجعة الأزمنة',
        ruleEn: [ 'Present simple: facts and habits (I play).', 'Past simple: finished actions (I played).' ],
        ruleAr: [ 'المضارع البسيط: الحقائق والعادات.', 'الماضي البسيط: أحداث انتهت في الماضي.' ],
        examples: [ 'Teachers and students use modern technologies.', 'There were no computers 30 years ago.' ],
        exercises: [
          { type: 'fill', prompt: 'Thirty years ago, there ___ no computers.', options: ['were', 'are', 'will be', 'have been'], answer: 0, explainAr: 'الجملة عن الماضي (30 years ago) فنستخدم الماضي البسيط.' },
          { type: 'mcq', prompt: 'Which sentence is in the future simple?', options: ['Schools will use robots.', 'Schools use robots.', 'Schools used robots.', 'Schools are using robots.'], answer: 0 },
          { type: 'truefalse', prompt: '"I have visited Jordan" is present perfect.', answer: true },
          { type: 'build', prompt: 'رتّب الكلمات لتكوّن جملة صحيحة', answer: 'She has already finished her homework.' },
          // 12–20 exercises per unit. Every book exercise item should appear (as fill/mcq/build), plus extra items you write to cover the rule.
        ],
      },
      pronunciation: { title: 'Silent letters', ruleAr: 'بعض الحروف تُكتب ولا تُلفظ.', groups: [ { label: 'silent k', words: ['know', 'knee'] }, { label: 'silent b', words: ['climb', 'thumb'] } ] },
      listening: { taskAr: 'حوار بين معلّم وطلاب في بداية العام الدراسي.', items: ['...'] },
      writing: { taskAr: 'اكتب جملاً باستخدام أدوات الربط.', linkers: ['and', 'but', 'or'], model: ['...'] },
      sentences: [
        'Modern technologies have played a major role in education.',
        // 10–16 SHORT sentences (5–10 words) taken from the reading text / examples / exercises; used for "build the sentence" and "listen" tasks. Keep them grammatical and self-contained.
      ],
    },
    // second unit ...
  ],
  focus: { title: 'Focus on Physics', paragraphs: ['...verbatim...'], glossary: [{ en: 'force', ar: 'قوة' }] },
  project: { title: 'Project 1', steps: ['...'] },
}
```

Rules
- Strings must be valid TypeScript (escape quotes; prefer double quotes for strings containing apostrophes).
- `answer` for mcq/fill is the INDEX of the correct option (0-based). Options must have 3–4 items, exactly one correct.
- fill prompts contain `___` where the blank is.
- `build` answer is a plain English sentence (4–9 words). `prompt` may hold an Arabic hint.
- Vocabulary: key words from the book first, then other useful words from the reading/exercises. Every entry needs `en`, `ar`, `pos`; `def` and `example` where available. No duplicate `en` inside a unit. Use lowercase base forms (e.g. `provide`, not `to provide`).
- Arabic must be correct and natural.
- `emoji` per unit: pick a fitting single emoji.
- Module colors: 1 `#58cc02`, 2 `#1cb0f6`, 3 `#ce82ff`, 4 `#ff9600`, 5 `#ff4b4b`, 6 `#2b70c9`.
