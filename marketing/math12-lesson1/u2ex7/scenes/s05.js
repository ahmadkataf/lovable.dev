solution('s05', {
  tag: '⓳', progress: '2 / 4',
  q: 'ليكن $\\mathcal C$ الخطّ البياني للتابع $f$ المعرّف على $\\mathbb R$ وفق $f(x)=\\sqrt{x^2+4x+5}$.<br>① احسب $\\lim_{x\\to+\\infty}f(x)$.   ② a. اكتب ثلاثي الحدود $x^2+4x+5$ بالصيغة القانونيّة (متمّماً إلى مربّع كامل).  b. استنتج وجود مقارب مائل للخطّ $\\mathcal C$ في جوار $+\\infty$. اكتب معادلته.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }] },
    2: { rows: [{ t: 'x^2+4x+5=(x+2)^2+1', tex: true }] },
    3: { page: true, rows: [{ t: 'f(x)-(x+2)=\\dfrac{1}{f(x)+x+2}\\ \\xrightarrow[x\\to+\\infty]{}\\ 0', tex: true }], box: { t: '$y=x+2$ مقارب مائل في جوار $+\\infty$', c: 'grn' },
         side: [{ type: 'graph', xmin: -6, xmax: 5, ymin: -0.5, ymax: 7, h: 380, xt: [-2], yt: [], fns: [{ f: 'x+2', c: 'blu', dash: true, from: -2.4 }, { f: 'sqrt(x*x+4*x+5)' }] }] },
  },
})
