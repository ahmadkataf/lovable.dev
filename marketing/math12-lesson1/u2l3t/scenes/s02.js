solution('s02', {
  tag: 'تدرَّبْ ❶ · ①', progress: '1 / 4', ring: 'card',
  q: 'احسب نهايات التوابع الآتية عند $+\\infty$ وعند $-\\infty$ وعند النقاط $a$ المعطاة، ويمكن عند الحاجة حساب النهاية من اليمين ومن اليسار عند $a$.<br>① $f(x)=\\dfrac{2x^2}{(x-1)(2-x)}$ ، $\\ a=1,\\,2$',
  beats: {
    0: { side: [{ type: 'graph', xmin: -3, xmax: 5, ymin: -12, ymax: 12, h: 380, yt: [[-2, '-2']], fns: [{ f: '2*x*x/((x-1)*(2-x))', from: -3, to: 0.9 }, { f: '2*x*x/((x-1)*(2-x))', from: 1.07, to: 1.9 }, { f: '2*x*x/((x-1)*(2-x))', from: 2.1, to: 5 }], hl: [[-2, 'blu', '$y=-2$']], vl: [[1, 'grn', '', 1], [2, 'grn', '', 1]] }] },
    1: { rows: ['المقام: حدّه المسيطر $-x^2$', { t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim\\frac{2x^2}{-x^2}=-2', tex: true }] },
    2: { rows: [{ t: 'x\\to1:\\ \\ 2x^2\\to2,\\quad\\lim_{1^+}f=+\\infty,\\quad\\lim_{1^-}f=-\\infty', tex: true }] },
    3: { rows: [{ t: 'x\\to2:\\ \\ 2x^2\\to8,\\quad\\lim_{2^+}f=-\\infty,\\quad\\lim_{2^-}f=+\\infty', tex: true }], box: { t: 'المقام: $x-1$ و $2-x$ ، ادرس إشارة كلّ منهما', c: 'yel' } },
  },
})
