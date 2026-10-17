solution('s06', {
  tag: '❶ (⑦⑧)', progress: '1 / 3', head: '❶ نهاية $f$ عند أطراف مجموعة تعريفه (من اليمين ومن اليسار عند اللّزوم)',
  q: '⑦ $f(x)=2x+\\sin x$     ⑧ $f(x)=x^2+2x-\\dfrac1x$',
  beats: {
    1: { rows: ['⑦ $D_f=\\mathbb R$', { t: '\\sin x\\ge-1\\ \\Rightarrow\\ f(x)\\ge2x-1\\xrightarrow[x\\to+\\infty]{}+\\infty', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=+\\infty$', c: 'grn' },
         side: [{ type: 'graph', xmin: -7, xmax: 7, ymin: -13, ymax: 13, h: 400, xt: [], fns: [{ f: '2*x-1', c: 'blu', dash: true }, { f: '2*x+1', c: 'grn', dash: true }, { f: '2*x+sin(x)' }] }] },
    2: { rows: [{ t: '\\sin x\\le1\\ \\Rightarrow\\ f(x)\\le2x+1\\xrightarrow[x\\to-\\infty]{}-\\infty', tex: true }], box: { t: '$\\lim_{x\\to-\\infty}f(x)=-\\infty$', c: 'grn' } },
    3: { page: true, rows: ['⑧ $D_f=\\mathbb R^*$', { t: '\\lim_{x\\to\\pm\\infty}f(x)=+\\infty', tex: true }, { t: '\\lim_{x\\to0^+}f(x)=-\\infty\\qquad\\lim_{x\\to0^-}f(x)=+\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -4, xmax: 3, ymin: -8, ymax: 14, h: 400, xt: [-2, 1], fns: [{ f: 'x*x+2*x-1/x', n: 800 }] }], clear: true },
  },
})
