solution('s06', {
  tag: '⓱ (⑦)', progress: '7 / 10', head: U2X6_H,
  q: '⑦ $f(x)=\\dfrac{x^2+6x+1}{x^2-1}$',
  beats: {
    1: { rows: ['$\\mathcal D_f=\\mathbb R\\setminus\\{-1,1\\}$', 'البسط عند $1$: $8\\ne0$ ،  وعند $-1$: $-4\\ne0$'], box: { t: 'شاقوليّان: $x=1$ و $x=-1$', c: 'grn' } },
    2: { rows: [{ t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim_{x\\to\\pm\\infty}\\dfrac{x^2}{x^2}=1', tex: true }], box: { t: 'أفقي: $y=1$', c: 'grn' },
         side: [{ type: 'graph', xmin: -5, xmax: 5, ymin: -10, ymax: 12, h: 400, xt: [-1, 1], yt: [1], fns: [{ f: '(x*x+6*x+1)/(x*x-1)', n: 1200 }], vl: [[-1, 'blu', ''], [1, 'blu', '']], hl: [[1, 'grn', '']] }] },
  },
})
