# Solutions video spec — «تدرّب» of Lesson 1 (page 11)

Second video of the lesson: **every** exercise of «تدرّب» on page 11 solved step by step — 4 exercises,
19 sub-questions, none skipped (state curriculum). Same narrator, same look as the lesson video.

Everything in `../SCRIPT_SPEC.md` applies (file format, `say`/`screen` rules, spoken-math conventions,
building blocks, palette), except the content requirements, which are replaced by the ones below.
The exercise statements are in `../lesson-content.md` (page 11) and the page image `p011.png`.

`script.json` here also has a top-level `"crumb": "الوحدة الأولى · حلول «تدرّب» الدرس الأول"`.

## Content requirements
1. **Intro (≤ 20 s):** what this video is (all of «تدرّب», page 11), how to use it: pause at every
   countdown and try first. Show the page thumbnail.
2. For **each** sub-question, in the book's order (①, ②-1 … ②-8, ③-1 … ③-3, ④-1 … ④-9):
   - show the exact statement from the book (Arabic + LaTeX, same notation);
   - a pause-and-think beat (`hold` 3–5 s) with a hint of *which tool from the lesson* to use;
   - the solution, written the way a student must write it in the exam (each step on screen, each step said);
   - the final answer clearly boxed;
   - when useful, one line «انتبه» on the classic mistake.
3. Exercise ③-1 («تحقّق أنّ $v_n>0$ أيّاً كان $n$») is naturally an induction argument; explain it simply
   (each term is computed from a positive term by a formula that keeps positivity) and say that lesson 2
   («البرهان بالتدريج») gives the formal method.
4. Exercise ④ items whose formula is not defined for every $n$ (e.g. ④-5 at $n=2$, ④-1 at $n=0$) or whose
   monotonicity starts later (e.g. ④-6: $u_0<u_1$ but decreasing from $n=1$) must state the domain / $n_0$
   explicitly — this is exactly the lesson's $n_0$ idea.
5. Choose for each item of ④ the most natural of the lesson's three methods and name it
   («إشارة الفرق»، «اطّراد التابع»، «مقارنة النسبة بالواحد»).
6. Outro: quick recap of the tools used, and a teaser of lesson 2.
7. Pace: brisk but never rushed; ≈ 2400–3000 words in total. Exercises ①, ②-1 and ③ were already solved in the
   lesson video: solve them again completely here, but more briskly.

All numbers must be exact; verify every computation with python/sympy before writing it.
