solution('s03', {
  tag: '⓲ (①)', progress: '1 / 4',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R$ وفق $f(x)=\\sqrt{x^2+2x+4}$.<br>① a. احسب $\\lim_{x\\to+\\infty}f(x)$ ثمّ $\\lim_{x\\to+\\infty}\\big(f(x)-(x+1)\\big)$.  b. استنتج وجود مقارب مائل $\\Delta$ للخطّ البياني $\\mathcal C$ في جوار $+\\infty$.  c. ادرس الوضع النسبي للمقارب $\\Delta$ والخطّ $\\mathcal C$.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }, { t: 'f(x)-(x+1)=\\dfrac{(x^2+2x+4)-(x+1)^2}{f(x)+x+1}=\\dfrac{3}{f(x)+x+1}\\to0', tex: true }] },
    2: { box: { t: 'b. $\\Delta:\\ y=x+1$ مقارب مائل في جوار $+\\infty$', c: 'grn' } },
    3: { page: true, rows: [{ t: 'f(x)=\\sqrt{(x+1)^2+3}>|x+1|\\ge-(x+1)', tex: true }, { t: '\\Rightarrow\\ f(x)+x+1>0\\ \\Rightarrow\\ f(x)-(x+1)>0', tex: true }], box: { t: 'c. $\\mathcal C$ فوق $\\Delta$ دائماً', c: 'grn' },
         side: [{ ...U2X7_18, fns: [U2X7_18.fns[0], U2X7_18.fns[2]], labels: [U2X7_18.labels[0]] }] },
  },
})
