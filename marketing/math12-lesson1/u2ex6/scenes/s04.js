solution('s04', {
  tag: '⓱ (③④)', progress: '4 / 10', head: U2X6_H,
  q: '③ $f(x)=1-\\dfrac2x+\\dfrac x2$     ④ $f(x)=1-x+\\dfrac{3x}{x^2+2}$',
  beats: {
    1: { rows: ['③ $\\mathcal D_f=\\mathbb R^*$', { t: '\\lim_{x\\to0^+}f(x)=-\\infty,\\qquad\\lim_{x\\to0^-}f(x)=+\\infty', tex: true }, { t: 'f(x)-\\big(\\tfrac x2+1\\big)=-\\dfrac2x\\to0', tex: true }], box: { t: '③ شاقولي $x=0$ ،  مائل $y=\\frac x2+1$', c: 'grn' },
         side: [{ type: 'graph', xmin: -8, xmax: 8, ymin: -8, ymax: 8, h: 380, xt: [], yt: [1], fns: [{ f: 'x/2+1', c: 'blu', dash: true }, { f: '1-2/x+x/2', n: 1000 }] }] },
    2: { page: true, rows: ['④ $x^2+2\\ne0$ ← لا مقارب شاقولي', { t: 'f(x)-(1-x)=\\dfrac{3x}{x^2+2}\\ \\xrightarrow[x\\to\\pm\\infty]{}\\ 0', tex: true }], box: { t: '④ مائل $y=-x+1$', c: 'grn' },
         side: [{ type: 'graph', xmin: -6, xmax: 6, ymin: -6, ymax: 7, h: 380, xt: [], yt: [1], fns: [{ f: '1-x', c: 'blu', dash: true }, { f: '1-x+3*x/(x*x+2)' }] }], clear: true },
  },
})
