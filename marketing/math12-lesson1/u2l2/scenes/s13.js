solution('s13', {
  tag: 'تدرَّبْ ❶ (تتمّة)', progress: '1 / 2',
  q: '④ $f(x)=\\dfrac{5x+1}{x+1},\\ a=-1$   ⑤ $f(x)=\\dfrac{x+2}{(x-2)^2},\\ a=2$   ⑥ $f(x)=3x-5+\\dfrac{2}{x+2},\\ a=-2$',
  beats: {
    0: { rows: ['④ $\\lim_{\\pm\\infty}f=5$', { t: 'x\\to-1:\\ \\ 5x+1\\to-4,\\quad\\lim_{-1^+}=-\\infty,\\quad\\lim_{-1^-}=+\\infty', tex: true }] },
    1: { rows: ['⑤ درجة البسط $<$ درجة المقام: $\\ \\lim_{\\pm\\infty}f=0$', { t: 'x\\to2:\\ \\ x+2\\to4,\\ \\ (x-2)^2>0\\ \\Rightarrow\\ \\lim_{x\\to2}f(x)=+\\infty', tex: true }], box: { t: '⑤ للتابع نهاية عند $2$: $+\\infty$ (من الجهتين)', c: 'grn' },
         side: [{ type: 'graph', xmin: -3, xmax: 7, ymin: -1, ymax: 12, h: 360, fns: [{ f: '(x+2)/((x-2)*(x-2))', from: -3, to: 1.4 }, { f: '(x+2)/((x-2)*(x-2))', from: 2.6, to: 7 }], vl: [[2, 'grn', '$x=2$']], hl: [[0, 'blu', '', 0]] }] },
    2: { page: true, rows: ['⑥ $\\frac{2}{x+2}\\to0$: $\\ \\lim_{+\\infty}f=+\\infty$ ، $\\lim_{-\\infty}f=-\\infty$'], clear: true },
    3: { rows: [{ t: 'x\\to-2:\\ \\ 3x-5\\to-11,\\quad\\lim_{-2^+}\\tfrac{2}{x+2}=+\\infty,\\quad\\lim_{-2^-}\\tfrac{2}{x+2}=-\\infty', tex: true }], box: { t: '⑥ $\\lim_{-2^+}f=+\\infty$ ، $\\lim_{-2^-}f=-\\infty$', c: 'grn' } },
  },
})
