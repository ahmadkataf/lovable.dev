var U2A_C = { xmin: -0.15, xmax: 1.5, ymin: -0.1, ymax: 1.33, h: 470, ax: ['', ''], fns: [{ f: 'sqrt(max(0,1-x*x))', from: 0, to: 1, c: 'mut', w: 3 }],
  segs: [[0, 0, 1, 1.2602, 'blu'], [0, 0, 0.6216, 0.7833, 'yel'], [0.6216, 0, 0.6216, 0.7833, 'yel', 1], [1, 0, 1, 1.2602, 'grn'], [0.6216, 0.7833, 1, 0, 'yel']],
  labels: [['$O$', -0.07, -0.06, 'c', 'mut'], ['$A$', 1.04, -0.06, 'c', 'mut'], ['$M$', 0.58, 0.86, 'c', 'yel'], ['$T$', 1.06, 1.27, 'c', 'grn'], ["$M'$", 0.62, -0.06, 'c', 'yel'], ['$h$', 0.2, 0.08, 'c', 'pur']] }
solution('s07', {
  title: 'نشاط 2 · ❷ حالة $h\\in\\left]0,\\frac\\pi2\\right[$', paper: '🧪 نشاط 2', paperType: 'think',
  beats: {
    0: { rows: ['$OA=1$ ، $OM\'=\\cos h$ ، $MM\'=\\sin h$ ، طول القوس $\\overset{\\frown}{AM}=h$'], side: [{ type: 'graph', ...U2A_C }] },
    1: { rows: [{ t: '\\mathcal A(OAM)\\le\\mathcal A(\\text{القطاع})\\le\\mathcal A(OAT)\\qquad(*)', tex: true }] },
    2: { page: true, rows: ['القطاع: $\\ \\frac{h}{2}$ (نصف مربّع نصف القطر × الزاوية)', 'المثلّث $OAM$: $\\ \\frac12\\times1\\times\\sin h$'] },
    3: { rows: ['المثلّث $OAT$: $\\ AT=\\tan h=\\dfrac{\\sin h}{\\cos h}$ ⟸ $\\ \\frac12\\times\\frac{\\sin h}{\\cos h}$'] },
    4: { page: true, rows: [{ t: '\\sin h\\le h\\le\\frac{\\sin h}{\\cos h}', tex: true, cls2: 'ml' }], box: { t: '$\\cos h\\le\\dfrac{\\sin h}{h}\\le1$', c: 'grn' } },
  },
})
