var U2X3_H = '❾ ادرس في كلّ حالة نهاية التابع $f$ عند $a$، وادرس عند الضرورة النهاية من اليمين ومن اليسار.'
solution('s03', {
  tag: '❾ (①)', progress: '1 / 2', head: U2X3_H,
  q: '① $f(x)=\\dfrac{x-4}{x^2-6x+5}$  ،  $a=-\\infty,\\,1,\\,5,\\,+\\infty$',
  beats: {
    1: { rows: [{ t: 'x^2-6x+5=(x-1)(x-5)', tex: true }, { t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim_{x\\to\\pm\\infty}\\dfrac{x}{x^2}=\\lim_{x\\to\\pm\\infty}\\dfrac1x=0', tex: true }] },
    2: { page: true, rows: ['$x-4\\to-3$ ،  $x-5\\to-4$', { t: '\\begin{array}{c|ccccc}x&&1&&5&\\\\\\hline (x-1)(x-5)&+&0&-&0&+\\end{array}', tex: true }, { t: '\\lim_{x\\to1^+}f(x)=+\\infty\\qquad\\lim_{x\\to1^-}f(x)=-\\infty', tex: true }] },
    3: { rows: [{ t: '\\lim_{x\\to5^+}f(x)=+\\infty\\qquad\\lim_{x\\to5^-}f(x)=-\\infty', tex: true }], box: { t: 'مقاربان شاقوليّان: $x=1$ و $x=5$', c: 'grn' },
         side: [{ type: 'graph', xmin: -2, xmax: 8, ymin: -6, ymax: 6, h: 380, xt: [1, 5], yt: [], fns: [{ f: '(x-4)/((x-1)*(x-5))', n: 1000 }], vl: [[1, 'blu', ''], [5, 'blu', '']] }], clear: true },
  },
})
