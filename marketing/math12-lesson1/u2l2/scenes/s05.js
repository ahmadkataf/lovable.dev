var U2L2_R = { xmin: -0.3, xmax: 5, ymin: -0.4, ymax: 6, h: 400, fns: [{ f: '1/sqrt(x)', from: 0.028, to: 5 }] }
solution('s05', {
  title: 'مثال: $f:x\\mapsto\\dfrac1{\\sqrt x}$ عند $0$', paper: '✏️ مثال', paperType: 'ex',
  beats: {
    0: { rows: ['$D_f=\\,]0,+\\infty[$ ، و $0\\notin D_f$ لكنّه طرف للمجال'], side: [{ type: 'graph', ...U2L2_R }] },
    1: { rows: ['$x\\to0$ ⟸ $\\frac1{\\sqrt x}$ يكبر أكثر فأكثر', 'إذا كان $0<x<\\frac1{M^2}$ كان $\\frac1{\\sqrt x}>M$'],
         side: [{ type: 'graph', ...U2L2_R, hl: [[2, 'pur', '$M$', 0]], vband: [0, 0.25, 'yel'], xt: [[0.25, '\\tfrac1{M^2}']] }], clear: true },
    2: { rows: [{ t: 'M=10:\\ \\ x<\\tfrac1{100}\\Rightarrow\\sqrt x<\\tfrac1{10}\\Rightarrow\\tfrac1{\\sqrt x}>10', tex: true }] },
    3: { page: true, rows: [{ t: '\\lim_{x\\to0^+}\\frac1{\\sqrt x}=+\\infty\\quad\\text{أو}\\quad\\lim_{x\\to0}\\frac1{\\sqrt x}=+\\infty', tex: true }], box: { t: 'محور التراتيب $x=0$: مقارب شاقولي', c: 'grn' } },
  },
})
