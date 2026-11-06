var U2L6_G = { xmin: -0.3, xmax: 10, ymin: -0.5, ymax: 10, h: 400, fns: [{ f: 'x+1+3/(x+0.6)', from: 0.05, to: 10 }, { f: 'x+1', c: 'blu', dash: true }], labels: [['$\\Delta$', 9, 8.7, 'c', 'blu'], ['$\\mathcal C_f$', 0.9, 6, 'c', 'red']] }
solution('s03', {
  title: 'تعريف 5: المقارب المائل', paper: '📘 تعريف 5', paperType: 'def',
  beats: {
    0: { rows: ['$f$ معرّف على $]b,+\\infty[$ ، $\\mathcal C_f$ خطّه البياني', '$\\Delta:\\ y=ax+b$'], side: [{ type: 'graph', ...U2L6_G }] },
    1: { rows: ['$\\Delta$ مقارب لـ $\\mathcal C_f$ في جوار $+\\infty$ ⟺'], box: { t: '$\\lim_{x\\to+\\infty}\\big(f(x)-(ax+b)\\big)=0$', c: 'grn' } },
    2: { page: true, rows: [{ t: 'PM=\\big|f(x)-(ax+b)\\big|', tex: true, cls2: 'ml' }, 'كلّما كبر $x$ صغرت $PM$'],
         side: [{ type: 'graph', ...U2L6_G, segs: [[5, 6, 5, 6.538, 'yel']], pts: [[5, 6.538, 'c', 'red'], [5, 6, 'c', 'blu']], labels: [...U2L6_G.labels, ['$M$', 5.5, 7.1, 'c', 'red'], ['$P$', 5.5, 5.4, 'c', 'blu']], vl: [[5, 'mut', '', 1]] }], clear: true },
    3: { rows: ['الفرق $>0$: المنحني فوق المقارب', 'الفرق $<0$: المنحني تحته'], box: { t: 'إشارة الفرق = الوضع النسبي', c: 'yel' } },
  },
})
