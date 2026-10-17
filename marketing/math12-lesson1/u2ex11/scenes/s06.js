solution('s06', {
  tag: '㊲ (③b c)', progress: '1 / 2', head: U2X11_H,
  q: '③ b. أوجد معادلةً للمماس $T$ للخطّ البياني $\\mathcal C$ في النقطة $A$ منه علماً أنّ فاصلة $A$ تساوي الصفر.  c. ارسم $T$ ومقاربي $\\mathcal C$ ثمّ ارسم $\\mathcal C$.',
  beats: {
    1: { rows: [{ t: "f(0)=1,\\qquad f'(0)=0", tex: true }, { t: 'T:\\ y=0\\cdot(x-0)+1', tex: true }], box: { t: '$T:\\ y=1$ (مماس أفقي)', c: 'grn' } },
    2: { rows: ['المقاربات أوّلاً ← المماس ← الفروع الثلاثة'],
         side: [{ ...{ type: 'graph', xmin: -5, xmax: 5, ymin: -7, ymax: 9, h: 400, xt: [-1, 1], yt: [1], fns: [{ f: 'x+1', c: 'blu', dash: true, from: -1 }, { f: '-x-1', c: 'grn', dash: true, to: -1 }, { f: 'abs(x+1)+x/(x*x-1)', n: 1600 }], vl: [[-1, 'mut', ''], [1, 'mut', '']] }, segs: [[-1.4, 1, 1.4, 1, 'yel']], pts: [[0, 1, 'c', 'yel'], [1.7321, 3.598, 'c', 'pur']], labels: [['$A$', 0.35, 1.8, 'c', 'yel'], ['$T$', -1.2, 1.7, 'c', 'yel']] }] },
  },
})
