solution('s05', {
  tag: '⓱ (⑤⑥)', progress: '6 / 10', head: U2X6_H,
  q: '⑤ $f(x)=\\dfrac{2x^2+5x-4}{x}$     ⑥ $f(x)=\\dfrac{x^2+2+\\sin x}{x}$',
  beats: {
    1: { rows: [{ t: 'f(x)=2x+5-\\dfrac4x', tex: true }], box: { t: '⑤ شاقولي $x=0$ ،  مائل $y=2x+5$', c: 'grn' } },
    2: { page: true, rows: [{ t: 'f(x)=x+\\dfrac{2+\\sin x}{x},\\qquad 1\\le2+\\sin x\\le3', tex: true }, { t: '\\lim_{x\\to0^+}f(x)=+\\infty,\\qquad\\lim_{x\\to0^-}f(x)=-\\infty', tex: true }] },
    3: { rows: [{ t: '\\Big|\\dfrac{2+\\sin x}{x}\\Big|\\le\\dfrac{3}{|x|}\\to0', tex: true }], box: { t: '⑥ شاقولي $x=0$ ،  مائل $y=x$', c: 'grn' },
         side: [{ type: 'graph', xmin: -12, xmax: 12, ymin: -12, ymax: 12, h: 380, xt: [], yt: [], fns: [{ f: 'x', c: 'blu', dash: true }, { f: 'x+(2+sin(x))/x', n: 1200 }] }] },
  },
})
