solution('s20', {
  tag: '④ · ❺', progress: '17 / 21', head: '④ ادرس جهة اطّراد كلٍّ من المتتاليات الآتية.',
  q: '❺ $u_n=\\dfrac{3n+1}{n-2}$',
  beats: {
    1: { hint: '🤔 أين المقام $=0$؟ ومن أين تبدأ؟ — <span class="yel">اطّراد التابع</span>' },
    2: { rows: ['المقام $n-2$ ينعدم عند $n=2$، فالحدّ $u_2$ غير معرّف'],
         side: [{ type: 'line', from: 0, to: 8, dots: [], bad: [[2, 'u₂ ✗']] }], clear: true },
    3: { rows: ['فندرس المتتالية $(u_n)_{n\\ge3}$'],
         side: [{ type: 'line', from: 0, to: 8, dots: [], bad: [[2, 'u₂ ✗']], bracket: [3, 'n₀ = 3'] }, { type: 'rich', t: '$\\{n_0,n_0+1,n_0+2,\\dots\\}$ ، $n_0=3$', cls: 's', dy: 270 }], clear: true },
    4: { rows: ['نكتب $u_n=f(n)$ حيث $f(x)=\\dfrac{3x+1}{x-2}$ على $[3,+\\infty[$:'] },
    5: { rows: [{ t: "f'(x)=\\dfrac{3(x-2)-1\\times(3x+1)}{(x-2)^2}=\\dfrac{\\cancel{3x}-6-\\cancel{3x}-1}{(x-2)^2}=\\dfrac{-7}{(x-2)^2}<0", tex: true }] },
    6: { rows: ['إذن $f$ متناقص تماماً على $[3,+\\infty[$'], box: { t: '$(u_n)_{n\\ge3}$ متتالية متناقصة تماماً', c: 'red' },
         side: [{ type: 'plot', pts: [[3, 10], [4, 6.5], [5, 16 / 3], [6, 4.75], [7, 4.4]], asym: 3, c: 'red', xmin: 2, xmax: 8, ymin: 0, ymax: 11, labels: [['$10$', 3, 10, 'cl'], ['$\\frac{13}{2}$', 4, 6.5, 'bc'], ['$\\frac{16}{3}$', 5, 16 / 3, 'bc']] }], clear: true },
    7: { rows: [{ t: 'f(x)=\\dfrac{3(x-2)+7}{x-2}=3+\\dfrac{7}{x-2}', tex: true, cls: 'blu' }] },
    8: { warn: ['$u_1=-4<u_3=10$: لا اطّراد عبر $n=2$', 'اكتب $n_0=3$ صراحةً'] },
  },
})
