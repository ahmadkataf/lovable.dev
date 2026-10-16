solution('s17', {
  tag: '④ · ❷', progress: '14 / 21', head: '④ ادرس جهة اطّراد كلٍّ من المتتاليات الآتية.',
  q: '❷ $u_n=\\sqrt{3n+1}$',
  beats: {
    1: { hint: "$u_n=f(n)$ — إشارة $f'(x)$؟ — <span class=\"yel\">اطّراد التابع</span>" },
    2: { rows: ['$3n+1\\ge1>0$ أيّاً كان $n$، إذن $n_0=0$'] },
    3: { rows: ['نكتب $u_n=f(n)$ حيث $f(x)=\\sqrt{3x+1}$'] },
    4: { rows: ['، وهو تابع معرّف على $\\left[-\\frac13,+\\infty\\right[$ الذي يحوي $[0,+\\infty[$'],
         side: [{ type: 'tex', t: '\\left[-\\tfrac13,\\ \\textcolor{#ffd23f}{\\underbrace{0,\\ +\\infty}_{[0,+\\infty[}}\\right[', cls: 'ml' }], clear: true },
    5: { rows: [{ t: "f'(x)=\\dfrac{3}{2\\sqrt{3x+1}}>0\\quad\\text{على}\\quad\\left]-\\tfrac13,+\\infty\\right[", tex: true }, 'إذن $f$ متزايد تماماً على $[0,+\\infty[$'],
         box: { t: '$(u_n)_{n\\ge0}$ متتالية متزايدة تماماً', c: 'grn' },
         side: [{ type: 'plot', pts: [[0, 1], [1, 2], [2, Math.sqrt(7)], [3, Math.sqrt(10)]], c: 'grn', xmin: 0, xmax: 4, ymin: 0, ymax: 3.8, labels: [['$1$', 0, 1, 'bc'], ['$2$', 1, 2, 'bc'], ['$\\sqrt7$', 2, Math.sqrt(7), 'bc'], ['$\\sqrt{10}$', 3, Math.sqrt(10), 'bc']] }], clear: true },
    6: { warn: ['$\\sqrt{3n+4}-\\sqrt{3n+1}=\\sqrt3$ ✗ (فرق الجذرين ليس جذر الفرق)', '$\\sqrt{3n+4}-\\sqrt{3n+1}=\\dfrac{3}{\\sqrt{3n+4}+\\sqrt{3n+1}}>0$ ✓'] },
  },
})
