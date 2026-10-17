solution('s07', {
  tag: '❼ (①②)', progress: '4 / 5',
  q: 'ليكن $f(x)=\\sqrt{2x^2+x+1}$ على $\\mathbb R$، و $\\mathcal C$ خطّه البياني. المطلوب إثبات أنّ $\\mathcal C$ يقبل مقارباً مائلاً في جوار $+\\infty$، وكذلك في جوار $-\\infty$.<br>① أثبت أنّ $\\lim_{x\\to+\\infty}\\big(\\sqrt{2x^2+x+1}-\\sqrt2\\,x\\big)=\\tfrac{\\sqrt2}{4}$.   ② استنتج $\\lim_{x\\to+\\infty}\\Big(f(x)-\\big(\\sqrt2\\,x+\\tfrac{\\sqrt2}{4}\\big)\\Big)$.',
  beats: {
    1: { rows: ['فهم السؤال: الحدّ المسيطر $2x^2$', { t: '\\sqrt{2x^2}=\\sqrt2\\,x\\qquad(x>0)', tex: true }] },
    2: { page: true, rows: [{ t: 'f(x)-\\sqrt2\\,x=\\dfrac{x+1}{\\sqrt{2x^2+x+1}+\\sqrt2\\,x}=\\dfrac{1+\\frac1x}{\\sqrt{2+\\frac1x+\\frac1{x^2}}+\\sqrt2}', tex: true }], box: { t: '① النهاية $=\\dfrac{1}{2\\sqrt2}=\\dfrac{\\sqrt2}{4}$', c: 'grn' } },
    3: { page: true, rows: [{ t: '\\lim_{x\\to+\\infty}\\Big(f(x)-\\big(\\sqrt2\\,x+\\tfrac{\\sqrt2}{4}\\big)\\Big)=\\tfrac{\\sqrt2}4-\\tfrac{\\sqrt2}4=0', tex: true }], box: { t: '② مقارب مائل عند $+\\infty$: $y=\\sqrt2\\,x+\\frac{\\sqrt2}{4}$', c: 'grn' },
         side: [{ type: 'graph', xmin: -5, xmax: 5, ymin: -0.5, ymax: 8, h: 380, xt: [], yt: [], fns: [{ f: 'SQRT2*x+SQRT2/4', c: 'blu', dash: true, from: -0.6 }, { f: 'sqrt(2*x*x+x+1)' }] }] },
  },
})
