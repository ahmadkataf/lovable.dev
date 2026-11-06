solution('s04', {
  tag: '㉞ (②③)', progress: '1 / 3', head: '㉞ مجموعة توابع مستمرّة',
  q: '② أوجد نهاية $f_m$ عند $+\\infty$ وعند $-\\infty$.   ③ استنتج ممّا سبق أنّ للمعادلة $f_m(x)=0$ ثلاثة حلول متمايزة في $\\mathbb R$، أيّاً يكن العدد $m$.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to+\\infty}f_m(x)=+\\infty,\\qquad\\lim_{x\\to-\\infty}f_m(x)=-\\infty', tex: true }] },
    2: { page: true, rows: [{ t: 'f_m(-1)=7>0,\\qquad f_m(1)=-7<0', tex: true }, '← حلّ في $]-1,1[$'],
         side: [{ type: 'graph', xmin: -4.2, xmax: 3.4, ymin: -14, ymax: 14, h: 380, xt: [-1, 1], yt: [], fns: [{ f: 'x*x*x+x*x-8*x-1' }], pts: [[-1, 7, 'c', 'yel'], [1, -7, 'c', 'yel'], [-0.1233, 0, 'c', 'grn']], labels: [['$m=1$', 2.6, 11, 'c', 'mut']] }] },
    3: { rows: ['$-\\infty$: يوجد $b<-1$ و $f_m(b)<0$ ← حلّ في $]b,-1[$', '$+\\infty$: يوجد $c>1$ و $f_m(c)>0$ ← حلّ في $]1,c[$'],
         side: [{ type: 'graph', xmin: -4.2, xmax: 3.4, ymin: -14, ymax: 14, h: 380, xt: [-1, 1], yt: [], fns: [{ f: 'x*x*x+x*x-8*x-1' }], pts: [[-1, 7, 'c', 'yel'], [1, -7, 'c', 'yel'], [-0.1233, 0, 'c', 'grn'], [-3.3194, 0, 'c', 'grn'], [2.4427, 0, 'c', 'grn']], labels: [['$m=1$', 2.6, 11, 'c', 'mut']] }], clear: true },
    4: { box: { t: 'ثلاثة حلول متمايزة بالضبط (الدرجة الثالثة)', c: 'grn' } },
  },
})
