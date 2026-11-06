solution('s05', {
  tag: '㉓', progress: '2 / 6',
  q: 'ليكن $\\mathcal C$ الخطّ البياني للتابع $f$ المعرّف على $\\mathbb R$ وفق $f(x)=x+\\dfrac{x}{\\sqrt{x^2+9}}$.<br>① a. أثبت أنّ المستقيم $\\Delta:\\ y=x+1$ مقاربٌ للخطّ $\\mathcal C$ في جوار $+\\infty$.  b. ادرس الوضع النسبي للمقارب $\\Delta$ والخطّ $\\mathcal C$.   ② أصحيحٌ أنّ المستقيم $\\Delta\':\\ y=x-1$ مقاربٌ للخطّ $\\mathcal C$ في جوار $-\\infty$؟',
  beats: {
    1: { rows: [{ t: 'f(x)-(x+1)=\\dfrac{x}{\\sqrt{x^2+9}}-1', tex: true }, { t: 'x>0:\\quad\\dfrac{x}{\\sqrt{x^2+9}}=\\dfrac{1}{\\sqrt{1+\\frac9{x^2}}}\\to1', tex: true }], box: { t: 'a. $\\Delta$ مقارب في جوار $+\\infty$', c: 'grn' } },
    2: { page: true, rows: [{ t: 'f(x)-(x+1)=\\dfrac{x-\\sqrt{x^2+9}}{\\sqrt{x^2+9}}<0', tex: true }, '$\\sqrt{x^2+9}>|x|\\ge x$'], box: { t: 'b. $\\mathcal C$ تحت $\\Delta$ دائماً', c: 'grn' } },
    3: { page: true, rows: [{ t: 'x<0:\\quad\\dfrac{x}{\\sqrt{x^2+9}}=\\dfrac{-1}{\\sqrt{1+\\frac9{x^2}}}\\to-1', tex: true }, { t: 'f(x)-(x-1)=\\dfrac{x}{\\sqrt{x^2+9}}+1\\to0', tex: true }], box: { t: "② نعم: $\\Delta':\\ y=x-1$ مقارب في جوار $-\\infty$", c: 'grn' },
         side: [{ type: 'graph', xmin: -8, xmax: 8, ymin: -8, ymax: 8, h: 400, xt: [], yt: [], fns: [{ f: 'x+1', c: 'blu', dash: true }, { f: 'x-1', c: 'grn', dash: true }, { f: 'x+x/sqrt(x*x+9)' }], labels: [['$\\Delta$', 5.2, 7.6, 'c', 'blu'], ["$\\Delta'$", -5.2, -7.4, 'c', 'grn']] }] },
  },
})
