solution('s04', {
  title: 'تذكّر: نهايات تساوي $0$', paper: '⭐ تذكّر', paperType: 'tip',
  beats: {
    0: { rows: ['عند $+\\infty$ النهاية $0$ لكلّ من:', { t: '\\frac1x,\\quad\\frac1{x^2},\\quad\\frac1{x^n}\\ (n\\ge1),\\quad\\frac1{\\sqrt x}', tex: true }],
         side: [{ type: 'graph', xmin: -0.5, xmax: 8, ymin: -0.4, ymax: 3, h: 380, yt: [1], xt: [1, 4],
                  fns: [{ f: '1/x', from: 0.34, to: 8, c: 'red' }, { f: '1/(x*x)', from: 0.58, to: 8, c: 'yel' }, { f: '1/sqrt(x)', from: 0.12, to: 8, c: 'grn' }],
                  labels: [['$\\frac1x$', 1.3, 1.25, 'c', 'red'], ['$\\frac1{x^2}$', 0.75, 2.4, 'c', 'yel'], ['$\\frac1{\\sqrt x}$', 3, 0.95, 'c', 'grn']] }] },
    1: { rows: ['$y=0$ (محور الفواصل): مقارب أفقي عند $+\\infty$', 'وعند $-\\infty$: $\\ \\frac1x,\\ \\frac1{x^2},\\ \\frac1{x^n}$'],
         side: [{ type: 'graph', xmin: -6, xmax: 6, ymin: -3, ymax: 3, h: 380, xt: [-1, 1], yt: [-1, 1], fns: [{ f: '1/x', from: -6, to: -0.34 }, { f: '1/x', from: 0.34, to: 6 }], hl: [[0, 'grn', '$y=0$', 0]] }], clear: true },
    2: { warn: ['$\\frac1{\\sqrt x}$ ليس عند $-\\infty$:', 'غير معرّف عند الأعداد السالبة'] },
  },
})
