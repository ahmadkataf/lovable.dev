var U2L6_E = { xmin: -7, xmax: 5, ymin: -8, ymax: 7, h: 400, grid: 1, fns: [{ f: '(x*x+3*x+1)/(x+2)', from: -7, to: -2.08 }, { f: '(x*x+3*x+1)/(x+2)', from: -1.92, to: 5 }, { f: 'x+1', c: 'blu', dash: true }], labels: [['$\\Delta$', -5.6, -3.5, 'c', 'blu']] }
solution('s04', {
  tag: 'مثال: مقارب مائل', ring: 'card',
  q: 'ليكن $\\mathcal C_f$ الخطّ البياني للتابع $f(x)=\\dfrac{x^2+3x+1}{x+2}$ ، وليكن $\\Delta:\\ y=x+1$. ① أثبت أنّ $\\Delta$ مقارب للخطّ $\\mathcal C_f$ في جوار $+\\infty$.   ② ادرس وضع $\\mathcal C_f$ بالنسبة إلى $\\Delta$.',
  beats: {
    0: { side: [{ type: 'graph', ...U2L6_E }] },
    1: { rows: [{ t: 'f(x)-(x+1)=\\frac{x^2+3x+1-(x^2+3x+2)}{x+2}=\\frac{-1}{x+2}', tex: true }] },
    2: { rows: [{ t: '\\lim_{x\\to+\\infty}\\frac{-1}{x+2}=0', tex: true }], box: { t: '① $\\Delta$ مقارب في جوار $+\\infty$', c: 'grn' } },
    3: { page: true, rows: [{ t: '\\begin{array}{c|ccc}x&-\\infty&\\quad-2\\quad&+\\infty\\\\\\hline x+2&-&\\Vert&+\\\\ f(x)-(x+1)&+&\\Vert&-\\end{array}', tex: true }], box: { t: '② فوق $\\Delta$ على $]-\\infty,-2[$ ، تحته على $]-2,+\\infty[$', c: 'grn' },
         side: [{ type: 'graph', ...U2L6_E, vband: [-7, -2, 'grn'] }], clear: true },
  },
})
