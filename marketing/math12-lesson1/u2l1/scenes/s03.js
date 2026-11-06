var U2L1_D = { xmin: -1, xmax: 14, ymin: -1, ymax: 5, h: 400, yt: [[2, '\\ell']], fns: [{ f: '2+3*sin(1.5*x)/(x+0.5)', from: -0.5, to: 14 }] }
solution('s03', {
  title: '1.1 النهاية الحقيقيّة عند $+\\infty$ ، والمقارب الأفقي', paper: '📘 تعريف 1', paperType: 'def',
  beats: {
    0: { rows: ['$f$ معرّف في جوار $+\\infty$: مجموعة تعريفه تحوي مجالاً $]a,+\\infty[$'] },
    1: { rows: ['قيم $f(x)$ تقترب من $\\ell$ (تتجمّع حوله) عندما يصبح $x$ كبيراً بما يكفي', { t: '\\lim_{x\\to+\\infty}f(x)=\\ell', tex: true, cls2: 'ml' }],
         side: [{ type: 'graph', ...U2L1_D, hl: [[2, 'blu', '', 0]] }] },
    2: { page: true, rows: ['مهما كان $\\varepsilon>0$:', 'قيم $f(x)$ تقع في $]\\ell-\\varepsilon,\\ell+\\varepsilon[$ بدءاً من قيمة معيّنة $A$'],
         side: [{ type: 'graph', ...U2L1_D, band: [1.6, 2.4, 'blu'], yt: [[2, '\\ell'], [2.4, '\\ell+\\varepsilon'], [1.6, '\\ell-\\varepsilon']], vl: [[7, 'yel', '$A$']] }], clear: true },
    3: { rows: ['قبل $A$: قد يخرج المنحني من الشريط', 'بعد $A$: يبقى داخله'], box: { t: 'الشريط عرضه $2\\varepsilon$ حول $\\ell$', c: 'blu' },
         side: [{ type: 'graph', ...U2L1_D, band: [1.6, 2.4, 'blu'], yt: [[2, '\\ell']], vl: [[7, 'yel', '$A$']], tracer: { x0: 1, x1: 13.5 }, follow: true, fa: .05, fb: .95 }], clear: true },
    4: { page: true, rows: ['المستقيم $y=\\ell$: مقارب أفقي للمنحني $\\mathcal C_f$ عند $+\\infty$'], box: { t: 'المنحني يقترب من $y=\\ell$ كلّما زاد $x$', c: 'grn' },
         side: [{ type: 'graph', ...U2L1_D, hl: [[2, 'grn', '$y=\\ell$']] }], clear: true },
    5: { rows: [{ t: '\\lim_{x\\to-\\infty}f(x)=\\ell', tex: true }, '$y=\\ell$: مقارب أفقي عند $-\\infty$'],
         side: [{ type: 'graph', xmin: -14, xmax: 1, ymin: -1, ymax: 5, h: 400, yt: [[2, '\\ell']], fns: [{ f: '2+3*sin(1.5*x)/(-x+0.5)', from: -14, to: 0.5 }], hl: [[2, 'grn', '$y=\\ell$']] }], clear: true },
  },
})
