solution('s02', {
  title: 'تذكير: المقلوب والقيمة المطلقة', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: '\\begin{array}{c|ccc}x&10&1000&10^6\\\\\\hline \\frac1x&0.1&0.001&0.000001\\end{array}', tex: true }, '$+\\infty$ ليست عدداً: $x$ يكبر دون توقّف'],
         side: [{ type: 'graph', xmin: -0.5, xmax: 10, ymin: -0.3, ymax: 3, h: 320, yt: [1], xt: [1, 5, 10], fns: [{ f: '1/x', from: 0.34, to: 10 }], hl: [[0, 'blu', '', 0]] }] },
    1: { page: true, rows: ['$|y-\\ell|$: المسافة بين $y$ و $\\ell$'], box: { t: '$|y-\\ell|<\\varepsilon\\ \\Leftrightarrow\\ \\ell-\\varepsilon<y<\\ell+\\varepsilon$', c: 'yel' },
         side: [{ type: 'graph', xmin: -0.5, xmax: 4.5, ymin: -1, ymax: 1, h: 150, ax: ['', ''], xt: [[1, '\\ell-\\varepsilon'], [2, '\\ell'], [3, '\\ell+\\varepsilon']], segs: [[1, 0, 3, 0, 'blu']], pts: [[1, 0, 'o', 'blu'], [3, 0, 'o', 'blu'], [2.4, 0, 'c', 'yel']], labels: [['$y$', 2.4, 0.6, 'c', 'yel']] }], clear: true },
  },
})
