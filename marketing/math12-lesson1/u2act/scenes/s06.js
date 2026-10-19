solution('s06', {
  title: 'نشاط 2: نهايات جديرة بالاهتمام', paper: '🧪 نشاط 2', paperType: 'think',
  beats: {
    0: { rows: ['الهدف:', { t: '\\lim_{x\\to0}\\frac{\\sin x}{x}\\qquad\\text{و}\\qquad\\lim_{x\\to0}\\frac{\\cos x-1}{x^2}', tex: true }] },
    1: { page: true, rows: [{ t: '\\begin{array}{c|ccccccc}h&\\pm2^0&\\pm2^{-1}&\\pm2^{-2}&\\pm2^{-3}&\\pm2^{-4}&\\cdots\\to0\\\\\\hline f(h)&0.84147&0.95885&0.98962&0.99740&0.99935&\\cdots\\to1\\end{array}', tex: true }],
         side: [{ type: 'graph', xmin: -7, xmax: 7, ymin: -0.4, ymax: 1.3, h: 300, yt: [1], fns: [{ f: 'x==0?1:sin(x)/x' }], pts: [[0, 1, 'o', 'yel']] }] },
    2: { rows: ['$f$ غير معرّف عند $0$ ، لكنّ قيمه تقترب من $1$'], box: { t: 'نتوقّع: $\\lim_{h\\to0}\\dfrac{\\sin h}{h}=1$ ، والآن نثبته', c: 'yel' } },
  },
})
