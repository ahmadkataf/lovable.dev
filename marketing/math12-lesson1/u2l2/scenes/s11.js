solution('s11', {
  title: 'مثال: $\\dfrac1x$ و $\\dfrac{|x|}x$ عند $0$', paper: '✏️ مثال', paperType: 'ex',
  beats: {
    0: { rows: [{ t: '\\lim_{x\\to0^-}\\frac1x=-\\infty,\\qquad\\lim_{x\\to0^+}\\frac1x=+\\infty', tex: true }, 'لا نهاية عند $0$ ، لكن توجد نهايتان من الجهتين'],
         side: [{ type: 'graph', xmin: -4, xmax: 4, ymin: -4, ymax: 4, h: 190, fns: [{ f: '1/x', from: -4, to: -0.25 }, { f: '1/x', from: 0.25, to: 4 }], labels: [['$\\frac1x$', -3, 3, 'c', 'mut']] }] },
    1: { rows: ['$x>0$: $\\ \\frac{|x|}{x}=1$   $x<0$: $\\ \\frac{|x|}{x}=-1$', { t: '\\lim_{x\\to0^-}\\frac{|x|}x=-1,\\qquad\\lim_{x\\to0^+}\\frac{|x|}x=+1', tex: true }],
         side: [{ type: 'graph', xmin: -4, xmax: 4, ymin: -2, ymax: 2, h: 190, dy: 205, yt: [1, -1], segs: [[-4, -1, 0, -1], [0, 1, 4, 1]], pts: [[0, 1, 'o'], [0, -1, 'o']], labels: [['$\\frac{|x|}x$', -3, 1.4, 'c', 'mut']] }] },
  },
})
