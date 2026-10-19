solution('s06', {
  tag: '㊱ (①②③)', progress: '3 / 3',
  q: 'ليكن $f(x)=\\sqrt{1+x^2}$ على $\\mathbb R$، و $\\mathcal C$ خطّه البياني في معلمٍ متجانس $(O;\\vec\\imath,\\vec\\jmath)$.<br>① أثبت أنّ للخطّ $\\mathcal C$ محور تناظر.   ② ادرس نهاية $f$ عند $+\\infty$ وعند $-\\infty$.   ③ أثبت أنّ $f(x)-x=\\dfrac{1}{x+\\sqrt{1+x^2}}$. استنتج أنّ $\\mathcal C$ يقبل مقارباً مائلاً $d$ في جوار $+\\infty$، وعيِّن الوضع النسبي للخطّ $\\mathcal C$ ومقاربه $d$.',
  beats: {
    1: { rows: ['$f(-x)=f(x)$ ← $f$ زوجي ← $(Oy)$ محور تناظر', { t: '\\lim_{x\\to\\pm\\infty}f(x)=+\\infty', tex: true }] },
    2: { page: true, rows: [{ t: 'f(x)-x=\\dfrac{(1+x^2)-x^2}{\\sqrt{1+x^2}+x}=\\dfrac{1}{x+\\sqrt{1+x^2}}', tex: true }, 'المقام $\\to+\\infty$ ← $d:\\ y=x$ مقارب مائل'] },
    3: { rows: ['$\\sqrt{1+x^2}>|x|$ ← المقام $>0$ ← $f(x)-x>0$'], box: { t: '$\\mathcal C$ فوق $d$', c: 'grn' },
         side: [{ type: 'graph', xmin: -4, xmax: 4, ymin: -0.5, ymax: 5, h: 360, xt: [], yt: [1], fns: [{ f: 'x', c: 'blu', dash: true, from: 0 }, { f: 'sqrt(1+x*x)' }], labels: [['$d$', 3.6, 4.4, 'c', 'blu']] }] },
  },
})
