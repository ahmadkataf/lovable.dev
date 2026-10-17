solution('s04', {
  tag: '❾ (②)', progress: '1 / 2', head: U2X3_H,
  q: '② $f(x)=\\dfrac{x^2-4x-12}{x^2-4}$  ،  $a=-\\infty,\\,-2,\\,2,\\,+\\infty$',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim_{x\\to\\pm\\infty}\\dfrac{x^2}{x^2}=1', tex: true }] },
    2: { page: true, rows: ['عند $-2$: $\\dfrac00$', { t: 'f(x)=\\dfrac{(x-6)(x+2)}{(x-2)(x+2)}=\\dfrac{x-6}{x-2}', tex: true }, { t: '\\lim_{x\\to-2}f(x)=\\dfrac{-8}{-4}=2', tex: true }], box: { t: 'ثقب عند $(-2,2)$ ، وليس مقارباً', c: 'yel' } },
    3: { page: true, rows: [{ t: '\\lim_{x\\to2^+}f(x)=-\\infty\\qquad\\lim_{x\\to2^-}f(x)=+\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -6, xmax: 8, ymin: -8, ymax: 10, h: 380, xt: [-2, 2], yt: [1], fns: [{ f: '(x-6)/(x-2)', n: 800 }], vl: [[2, 'blu', '$x=2$']], hl: [[1, 'grn', '$y=1$']], pts: [[-2, 2, 'o', 'yel']] }] },
  },
})
