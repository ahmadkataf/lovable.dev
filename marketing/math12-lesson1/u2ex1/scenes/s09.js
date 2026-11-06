solution('s09', {
  tag: '❸', progress: '3 / 3',
  q: 'أوجد نهاية التابع $f$ المعيّن بالعلاقة $f(x)=\\dfrac{-2x}{x+1}$ عند $-\\infty$ وعند $+\\infty$ وعند $-1$، ثمّ أوجد معادلات المستقيمات المقاربة لخطّه البياني، وبيّن وضع الخطّ البياني بالنسبة إلى مقاربه الأفقي.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to-1^+}f(x)=+\\infty\\qquad\\lim_{x\\to-1^-}f(x)=-\\infty', tex: true }, { t: '\\lim_{x\\to\\pm\\infty}f(x)=-2', tex: true }], box: { t: 'مقاربان: $x=-1$ و $y=-2$', c: 'grn' },
         side: [{ type: 'graph', xmin: -6, xmax: 5, ymin: -9, ymax: 6, h: 400, xt: [-1], yt: [-2], fns: [{ f: '-2*x/(x+1)', n: 800 }], vl: [[-1, 'blu', '$x=-1$']], hl: [[-2, 'grn', '$y=-2$']] }] },
    2: { page: true, rows: [{ t: 'f(x)+2=\\dfrac{2}{x+1}', tex: true }, '$x>-1$: $\\mathcal C$ فوق المقارب', '$x<-1$: $\\mathcal C$ تحت المقارب'] },
  },
})
