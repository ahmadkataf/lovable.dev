solution('s05', {
  tag: '❶ (⑤⑥)', progress: '1 / 3', head: '❶ نهاية $f$ عند أطراف مجموعة تعريفه (من اليمين ومن اليسار عند اللّزوم)',
  q: '⑤ $f(x)=(2x-3)(5-\\sqrt x)$     ⑥ $f(x)=\\cos x+\\dfrac1x$',
  beats: {
    1: { rows: ['⑤ $D_f=[0,+\\infty[$', { t: '\\lim_{x\\to0}f(x)=f(0)=(-3)(5)=-15', tex: true }, { t: '2x-3\\to+\\infty,\\quad 5-\\sqrt x\\to-\\infty', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=-\\infty$', c: 'grn' } },
    2: { page: true, rows: ['⑥ $D_f=\\mathbb R^*$', { t: '\\lim_{x\\to0^+}f(x)=+\\infty\\qquad\\lim_{x\\to0^-}f(x)=-\\infty', tex: true }] },
    3: { rows: ['$\\cos x$ يتذبذب بين $-1$ و $1$', { t: '\\cos x=f(x)-\\dfrac1x', tex: true }], box: { t: 'لا نهاية لـ $f$ عند $+\\infty$ ولا عند $-\\infty$', c: 'red' },
         side: [{ type: 'graph', xmin: -14, xmax: 14, ymin: -3, ymax: 3, h: 340, xt: [], fns: [{ f: 'cos(x)+1/x', n: 1200 }], band: [-1, 1, 'blu'] }] },
  },
})
