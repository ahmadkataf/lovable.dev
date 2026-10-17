var U2X7_21 = { type: 'graph', xmin: -2.4, xmax: 2.4, ymin: -1, ymax: 7.5, h: 400, xt: [], yt: [], fns: [{ f: '3*x', c: 'blu', dash: true }, { f: '-x', c: 'grn', dash: true }, { f: 'x+sqrt(abs(4*x*x-1))', n: 1200 }], labels: [['$\\Delta_1$', 2.2, 5.6, 'c', 'blu'], ['$\\Delta_2$', -2.1, 1.5, 'c', 'grn']] }
solution('s08', {
  tag: '㉑ (③)', progress: '4 / 4',
  q: '③ a. استنتج أنّ الخطّ $\\mathcal C$ يقبل مستقيمين مقاربين مائلين $\\Delta_1$ و $\\Delta_2$ يُطلب إيجاد معادلتيهما.  b. ادرس الوضع النسبي للخطّ $\\mathcal C$ وكلٍّ من المقاربين $\\Delta_1$ و $\\Delta_2$.',
  beats: {
    1: { rows: ['$\\Delta_1:\\ y=3x$ في جوار $+\\infty$', '$\\Delta_2:\\ y=-x$ في جوار $-\\infty$'], side: [U2X7_21] },
    2: { page: true, rows: [{ t: 'f(x)-3x=\\sqrt{|4x^2-1|}-2x', tex: true }, '$x\\le0$: موجب  ،  $x>0$: موجب فقط عندما $x^2<\\tfrac18$'], box: { t: '$\\mathcal C$ فوق $\\Delta_1$ قبل $\\tfrac{\\sqrt2}{4}$ ، وتحته بعدها', c: 'grn' },
         side: [{ ...U2X7_21, pts: [[0.35355, 1.06066, 'c', 'yel']] }], clear: true },
    3: { page: true, rows: [{ t: 'f(x)+x=2x+\\sqrt{|4x^2-1|}', tex: true }, 'موجب فقط عندما $x>-\\tfrac{\\sqrt2}{4}$'], box: { t: '$\\mathcal C$ تحت $\\Delta_2$ قبل $-\\tfrac{\\sqrt2}{4}$ ، وفوقه بعدها', c: 'grn' },
         side: [{ ...U2X7_21, pts: [[0.35355, 1.06066, 'c', 'yel'], [-0.35355, 0.35355, 'c', 'yel']] }], clear: true },
  },
})
