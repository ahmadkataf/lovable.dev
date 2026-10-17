solution('s05', {
  tag: '❾ (③)', progress: '1 / 2', head: U2X3_H,
  q: '③ $f(x)=\\dfrac{2x^3-x^2-1}{x^2+x-2}$  ،  $a=-\\infty,\\,-2,\\,1,\\,+\\infty$',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim_{x\\to\\pm\\infty}\\dfrac{2x^3}{x^2}=\\lim_{x\\to\\pm\\infty}2x=\\pm\\infty', tex: true }] },
    2: { page: true, rows: [{ t: 'f(x)=\\dfrac{(x-1)(2x^2+x+1)}{(x-1)(x+2)}=\\dfrac{2x^2+x+1}{x+2}', tex: true }, { t: '\\lim_{x\\to1}f(x)=\\dfrac{4}{3}', tex: true }],
         side: [{ type: 'chip', t: 'القسمة على $x-1$', c: 'yel' }] },
    3: { rows: [{ t: '\\lim_{x\\to-2^+}f(x)=+\\infty\\qquad\\lim_{x\\to-2^-}f(x)=-\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -7, xmax: 4, ymin: -28, ymax: 18, h: 380, xt: [-2, 1], yt: [], fns: [{ f: '(2*x*x+x+1)/(x+2)', n: 800 }], vl: [[-2, 'blu', '']], pts: [[1, 4 / 3, 'o', 'yel']] }], clear: true },
  },
})
