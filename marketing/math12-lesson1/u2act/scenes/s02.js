solution('s02', {
  tag: 'نشاط 1 · ❶ أمثلة', ring: 'card',
  q: '1. $f$ هو التابع المعرّف على $]0,+\\infty[$ وفق $f(x)=x-\\dfrac12+\\dfrac1x$.   ① لماذا يمكن تأكيد أنّ المستقيم $\\Delta:\\ y=x-\\frac12$ مقاربٌ للخطّ $\\mathcal C_f$ في جوار $+\\infty$؟   ② بيّنْ الوضع النسبي للخطّين $\\Delta$ و $\\mathcal C_f$.',
  beats: {
    1: { rows: [{ t: 'f(x)-\\left(x-\\tfrac12\\right)=\\frac1x\\to0', tex: true }], box: { t: '① $\\Delta$ مقارب ، ② $\\frac1x>0$: $\\mathcal C_f$ فوق $\\Delta$', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.3, xmax: 6, ymin: -1, ymax: 6, h: 380, fns: [{ f: 'x-0.5+1/x', from: 0.2, to: 6 }, { f: 'x-0.5', c: 'blu', dash: true }], labels: [['$\\Delta$', 5.4, 4.2, 'c', 'blu']] }] },
  },
})
