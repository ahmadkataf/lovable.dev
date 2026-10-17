solution('s06', {
  title: 'تذكّر: نهايات لانهائيّة', paper: '⭐ تذكّر', paperType: 'tip',
  beats: {
    0: { rows: ['عند $+\\infty$ النهاية $+\\infty$ لكلّ من:', { t: 'x,\\quad x^2,\\quad x^3,\\quad\\sqrt x', tex: true }],
         side: [{ type: 'graph', xmin: -0.5, xmax: 4, ymin: -0.5, ymax: 6, h: 380, fns: [{ f: 'x', c: 'red' }, { f: 'x*x', c: 'yel' }, { f: 'x*x*x', c: 'org' }, { f: 'sqrt(x)', from: 0, c: 'grn' }],
                  labels: [['$x$', 3.6, 3, 'c', 'red'], ['$x^2$', 2.1, 5.3, 'c', 'yel'], ['$x^3$', 1.25, 5.3, 'c', 'org'], ['$\\sqrt x$', 3.5, 1.5, 'c', 'grn']] }] },
    1: { page: true, rows: ['عند $-\\infty$:', '$x^2$ و $x^n$ ($n$ زوجي): $\\ +\\infty$', '$x$ و $x^n$ ($n$ فردي): $\\ -\\infty$'], box: { t: 'مربّع العدد السالب موجب', c: 'yel' },
         side: [{ type: 'graph', xmin: -3, xmax: 3, ymin: -5, ymax: 5, h: 380, fns: [{ f: 'x*x', c: 'yel' }, { f: 'x*x*x', c: 'org' }], labels: [['$x^2$', -2.5, 4.4, 'c', 'yel'], ['$x^3$', -1.2, -4.2, 'c', 'org']] }], clear: true },
  },
})
