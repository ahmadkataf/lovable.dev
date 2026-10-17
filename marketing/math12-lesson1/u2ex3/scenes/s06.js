solution('s06', {
  tag: '❾ (④)', progress: '1 / 2', head: U2X3_H,
  q: '④ $f(x)=\\dfrac{1}{x-3}-\\dfrac{2}{x^2-9}$  ،  $a=-\\infty,\\,-3,\\,3,\\,+\\infty$',
  beats: {
    1: { rows: [{ t: 'f(x)=\\dfrac{(x+3)-2}{(x-3)(x+3)}=\\dfrac{x+1}{(x-3)(x+3)}', tex: true }, { t: '\\lim_{x\\to\\pm\\infty}f(x)=0', tex: true }] },
    2: { rows: [{ t: '\\lim_{x\\to3^+}f(x)=+\\infty\\qquad\\lim_{x\\to3^-}f(x)=-\\infty', tex: true }] },
    3: { page: true, rows: [{ t: 'x\\to-3:\\quad f(x)\\approx\\dfrac{-2}{-6\\,(x+3)}=\\dfrac{1}{3(x+3)}', tex: true }, { t: '\\lim_{x\\to-3^+}f(x)=+\\infty\\qquad\\lim_{x\\to-3^-}f(x)=-\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -7, xmax: 7, ymin: -4, ymax: 4, h: 380, xt: [-3, 3], yt: [], fns: [{ f: '(x+1)/((x-3)*(x+3))', n: 1000 }], vl: [[-3, 'blu', ''], [3, 'blu', '']] }] },
  },
})
