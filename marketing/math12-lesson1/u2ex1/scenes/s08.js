solution('s08', {
  tag: '❷', progress: '2 / 3',
  q: 'أوجد نهاية التابع $f$ المعيّن بالعلاقة $f(x)=\\dfrac{2x+1}{x-1}$ عند $1$ وعند $-\\infty$ وعند $+\\infty$، ثمّ أوجد معادلات المستقيمات المقاربة لخطّه البياني، وبيّن وضع الخطّ البياني بالنسبة إلى مقاربه الأفقي.',
  beats: {
    1: { rows: ['$2x+1\\to3>0$ ، $x-1\\to0$', { t: '\\lim_{x\\to1^+}f(x)=+\\infty\\qquad\\lim_{x\\to1^-}f(x)=-\\infty', tex: true }], box: { t: 'مقارب شاقولي: $x=1$', c: 'grn' } },
    2: { rows: [{ t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim_{x\\to\\pm\\infty}\\dfrac{2x}{x}=2', tex: true }], box: { t: 'مقارب أفقي: $y=2$', c: 'grn' },
         side: [{ type: 'graph', xmin: -5, xmax: 7, ymin: -5, ymax: 9, h: 400, xt: [1], yt: [2], fns: [{ f: '(2*x+1)/(x-1)', n: 800 }], vl: [[1, 'blu', '$x=1$']], hl: [[2, 'grn', '$y=2$']] }] },
    3: { page: true, rows: [{ t: 'f(x)-2=\\dfrac{2x+1-2(x-1)}{x-1}=\\dfrac{3}{x-1}', tex: true }, '$x>1$: الفرق $>0$ ← $\\mathcal C$ فوق المقارب', '$x<1$: الفرق $<0$ ← $\\mathcal C$ تحت المقارب'] },
  },
})
