solution('s06', {
  tag: '⓴', progress: '3 / 4',
  q: 'ليكن $\\mathcal C$ الخطّ البياني للتابع $f$ المعرّف على $\\mathbb R$ وفق $f(x)=x+\\sqrt{x^2+1}$.<br>① ادرس نهاية $f$ عند $-\\infty$. اشرح التأويل الهندسيّ لهذه النتيجة.   ② أثبت أنّ المستقيم $\\Delta$ الذي معادلته $y=2x$ مقاربٌ للخطّ $\\mathcal C$ في جوار $+\\infty$.   ③ ادرس الوضع النسبي للمقارب $\\Delta$ والخطّ $\\mathcal C$.',
  beats: {
    1: { rows: [{ t: 'f(x)=\\dfrac{1}{\\sqrt{x^2+1}-x}\\ \\xrightarrow[x\\to-\\infty]{}\\ 0', tex: true }], box: { t: '① $y=0$ (محور الفواصل) مقارب أفقي في جوار $-\\infty$', c: 'grn' } },
    2: { page: true, rows: [{ t: 'f(x)-2x=\\sqrt{x^2+1}-x=\\dfrac{1}{\\sqrt{x^2+1}+x}\\ \\xrightarrow[x\\to+\\infty]{}\\ 0', tex: true }], box: { t: '② $\\Delta:\\ y=2x$ مقارب مائل', c: 'grn' } },
    3: { rows: [{ t: '\\sqrt{x^2+1}>|x|\\ge x\\ \\Rightarrow\\ f(x)-2x>0', tex: true }], box: { t: '③ $\\mathcal C$ فوق $\\Delta$', c: 'grn' },
         side: [{ type: 'graph', xmin: -6, xmax: 4, ymin: -1, ymax: 8, h: 380, xt: [], yt: [1], fns: [{ f: '2*x', c: 'blu', dash: true, from: -0.5 }, { f: 'x+sqrt(x*x+1)' }] }] },
  },
})
