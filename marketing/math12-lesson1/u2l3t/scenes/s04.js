solution('s04', {
  tag: 'تدرَّبْ ❶ · ③ ④', progress: '1 / 4',
  q: '③ $f(x)=x^2-2+\\dfrac{1}{(1-x)^2}$ ، $\\ a=1$   ④ $f(x)=x+\\dfrac1{1-x}-\\dfrac1{x-2}$ ، $\\ a=1,\\,2$',
  beats: {
    0: { rows: ['③ $\\frac1{(1-x)^2}\\to0$ و $x^2\\to+\\infty$:', { t: '\\lim_{x\\to\\pm\\infty}f(x)=+\\infty', tex: true }] },
    1: { rows: [{ t: 'x\\to1:\\ \\ \\frac1{(1-x)^2}\\to+\\infty,\\ \\ x^2-2\\to-1', tex: true }], box: { t: '③ $\\lim_{x\\to1}f(x)=+\\infty$ (من الجهتين)', c: 'grn' } },
    2: { page: true, rows: ['④ الكسران $\\to0$:', { t: '\\lim_{+\\infty}f=+\\infty,\\qquad\\lim_{-\\infty}f=-\\infty', tex: true }] },
    3: { rows: [{ t: 'x\\to1:\\ \\ \\lim_{1^+}f=-\\infty,\\quad\\lim_{1^-}f=+\\infty', tex: true }, { t: 'x\\to2:\\ \\ \\lim_{2^+}f=-\\infty,\\quad\\lim_{2^-}f=+\\infty', tex: true }] },
  },
})
