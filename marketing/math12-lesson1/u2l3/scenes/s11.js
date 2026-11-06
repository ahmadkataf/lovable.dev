solution('s11', {
  title: 'تكريساً للفهم: كثير الحدود عند اللانهاية', paper: '🧠 قاعدة', paperType: 'think',
  beats: {
    0: { rows: ['نهاية كثير الحدود عند $\\pm\\infty$ = نهاية حدّه المسيطر (الأعلى درجة)'] },
    1: { rows: [{ t: 'x^3-2x^2+x-1=x^3\\left(1-\\frac2x+\\frac1{x^2}-\\frac1{x^3}\\right)', tex: true }],
         side: [{ type: 'graph', xmin: -2, xmax: 4, ymin: -8, ymax: 14, h: 380, fns: [{ f: 'x*x*x-2*x*x+x-1', c: 'red' }, { f: 'x*x*x', c: 'blu', dash: true }], labels: [['$x^3$', 2.6, 13, 'c', 'blu']] }] },
    2: { rows: [{ t: '\\lim_{x\\to+\\infty}x^3=+\\infty,\\quad\\lim_{x\\to+\\infty}\\left(1-\\tfrac2x+\\tfrac1{x^2}-\\tfrac1{x^3}\\right)=1', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=+\\infty$', c: 'grn' } },
  },
})
