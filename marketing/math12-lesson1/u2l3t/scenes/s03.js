solution('s03', {
  tag: 'تدرَّبْ ❶ · ②', progress: '1 / 4',
  q: '② $f(x)=\\dfrac{2x+1}{x^2-4}$ ، $\\ a=2,\\,-2$',
  beats: {
    0: { rows: [{ t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim\\frac{2x}{x^2}=\\lim\\frac2x=0', tex: true }],
         side: [{ type: 'graph', xmin: -5, xmax: 5, ymin: -6, ymax: 6, h: 380, fns: [{ f: '(2*x+1)/(x*x-4)', from: -5, to: -2.08 }, { f: '(2*x+1)/(x*x-4)', from: -1.93, to: 1.93 }, { f: '(2*x+1)/(x*x-4)', from: 2.09, to: 5 }], vl: [[-2, 'grn', '', 1], [2, 'grn', '', 1]], xt: [-2, 2] }] },
    1: { rows: [{ t: 'x\\to2:\\ \\ 2x+1\\to5,\\quad\\lim_{2^+}f=+\\infty,\\quad\\lim_{2^-}f=-\\infty', tex: true }] },
    2: { rows: [{ t: 'x\\to-2:\\ \\ 2x+1\\to-3', tex: true }, '$x=-1.9$: $\\ x^2<4$ ، المقام سالب', { t: '\\lim_{-2^+}f=+\\infty,\\qquad\\lim_{-2^-}f=-\\infty', tex: true }] },
  },
})
