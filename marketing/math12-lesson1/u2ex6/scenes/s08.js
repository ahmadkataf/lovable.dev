solution('s08', {
  tag: '⓱ (⑨⑩)', progress: '10 / 10', head: U2X6_H,
  q: '⑨ $f(x)=\\dfrac{x^3+1}{x^2+2}$     ⑩ $f(x)=\\dfrac{3x^3+2x-1}{x^2+1}$',
  beats: {
    1: { rows: [{ t: 'x^3+1=x\\,(x^2+2)-2x+1', tex: true }, { t: 'f(x)=x+\\dfrac{-2x+1}{x^2+2}', tex: true }], box: { t: '⑨ مائل $y=x$ ،  لا شاقولي', c: 'grn' },
         side: [{ type: 'graph', xmin: -6, xmax: 6, ymin: -6, ymax: 6, h: 380, xt: [], yt: [], fns: [{ f: 'x', c: 'blu', dash: true }, { f: '(x*x*x+1)/(x*x+2)' }] }] },
    2: { page: true, rows: [{ t: '3x^3+2x-1=3x\\,(x^2+1)-x-1', tex: true }, { t: 'f(x)=3x-\\dfrac{x+1}{x^2+1}', tex: true }], box: { t: '⑩ مائل $y=3x$ ،  لا شاقولي', c: 'grn' },
         side: [{ type: 'graph', xmin: -3, xmax: 3, ymin: -9, ymax: 9, h: 380, xt: [], yt: [], fns: [{ f: '3*x', c: 'blu', dash: true }, { f: '(3*x*x*x+2*x-1)/(x*x+1)' }] }], clear: true },
  },
})
