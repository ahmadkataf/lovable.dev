solution('s08', {
  tag: '❾ (⑥⑦)', progress: '1 / 2', head: U2X3_H,
  q: '⑥ $f(x)=2x+\\sin^2x$ ، $a=-\\infty,\\,+\\infty$     ⑦ $f(x)=x^3(2+\\cos x)$ ، $a=-\\infty,\\,+\\infty$',
  beats: {
    0: { side: [{ type: 'chip', t: 'لا نهاية لـ $\\sin$ و $\\cos$ عند $\\infty$ ← المقارنة', c: 'yel' }] },
    1: { rows: ['⑥ $0\\le\\sin^2x\\le1$', { t: '2x\\le f(x)\\le2x+1', tex: true }, { t: '\\lim_{x\\to+\\infty}f(x)=+\\infty\\qquad\\lim_{x\\to-\\infty}f(x)=-\\infty', tex: true }] },
    2: { page: true, rows: ['⑦ $1\\le2+\\cos x\\le3$', { t: 'x>0:\\quad f(x)\\ge x^3\\ \\Rightarrow\\ \\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }] },
    3: { rows: [{ t: 'x<0:\\quad f(x)\\le x^3\\ \\Rightarrow\\ \\lim_{x\\to-\\infty}f(x)=-\\infty', tex: true }], box: { t: '$x^3<0$: الضرب في عدد $\\ge1$ يجعله أصغر', c: 'yel' },
         side: [{ type: 'graph', xmin: -6.5, xmax: 6.5, ymin: -700, ymax: 700, h: 380, xt: [], yt: [], fns: [{ f: 'x*x*x', c: 'blu', dash: true }, { f: '3*x*x*x', c: 'grn', dash: true }, { f: 'x*x*x*(2+cos(x))', n: 800 }] }], clear: true },
  },
})
