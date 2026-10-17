solution('s04', {
  tag: '⓫ (③)', progress: '1 / 3',
  q: '③ ادرس نهاية $f$ عند حدود المجالات الثلاثة التي تؤلّف $\\mathcal D_f$.<br>$f(x)=3+\\dfrac{1}{x+1}+\\dfrac{8}{x-2}$',
  beats: {
    1: { rows: ['$]-\\infty,-1[$  ،  $]-1,2[$  ،  $]2,+\\infty[$', { t: '\\lim_{x\\to\\pm\\infty}f(x)=3', tex: true }], box: { t: 'مقارب أفقي: $y=3$', c: 'grn' } },
    2: { rows: [{ t: '\\lim_{x\\to-1^-}f(x)=-\\infty\\qquad\\lim_{x\\to-1^+}f(x)=+\\infty', tex: true }] },
    3: { rows: [{ t: '\\lim_{x\\to2^-}f(x)=-\\infty\\qquad\\lim_{x\\to2^+}f(x)=+\\infty', tex: true }], box: { t: 'مقاربان شاقوليّان: $x=-1$ ، $x=2$', c: 'grn' },
         side: [{ type: 'graph', xmin: -6, xmax: 7, ymin: -14, ymax: 20, h: 400, xt: [-1, 2], yt: [3], fns: [{ f: '3+1/(x+1)+8/(x-2)', n: 1000 }], hl: [[3, 'grn', '$y=3$']], vl: [[-1, 'blu', ''], [2, 'blu', '']] }] },
  },
})
