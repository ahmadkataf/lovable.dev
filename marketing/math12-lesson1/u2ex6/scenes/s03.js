var U2X6_H = '⓱ بيِّن، في كلّ حالة، إنْ كان ثمّة مستقيمات مقاربة (أفقيّة أو شاقوليّة أو مائلة) للخطّ $\\mathcal C$.'
solution('s03', {
  tag: '⓱ (①②)', progress: '2 / 10', head: U2X6_H,
  q: '① $f(x)=\\dfrac{x+1}{x-3}$     ② $f(x)=-x+3+\\dfrac{2}{x^2+1}$',
  beats: {
    1: { rows: ['① عند $3$: $x+1\\to4\\ne0$', { t: '\\lim_{x\\to3^\\pm}f(x)=\\pm\\infty,\\qquad\\lim_{x\\to\\pm\\infty}f(x)=1', tex: true }], box: { t: '① شاقولي $x=3$ ،  أفقي $y=1$', c: 'grn' },
         side: [{ type: 'graph', xmin: -5, xmax: 10, ymin: -6, ymax: 8, h: 380, xt: [3], yt: [1], fns: [{ f: '(x+1)/(x-3)', n: 1000 }], vl: [[3, 'blu', '']], hl: [[1, 'grn', '']] }] },
    2: { page: true, rows: ['② $x^2+1\\ne0$ ← لا مقارب شاقولي', { t: 'f(x)-(-x+3)=\\dfrac{2}{x^2+1}\\ \\xrightarrow[x\\to\\pm\\infty]{}\\ 0', tex: true }], box: { t: '② مائل $y=-x+3$ عند $\\pm\\infty$', c: 'grn' },
         side: [{ type: 'graph', xmin: -5, xmax: 6, ymin: -4, ymax: 9, h: 380, xt: [], yt: [3], fns: [{ f: '-x+3', c: 'blu', dash: true }, { f: '-x+3+2/(x*x+1)' }] }], clear: true },
  },
})
