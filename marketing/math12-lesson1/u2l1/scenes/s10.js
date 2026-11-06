solution('s10', {
  title: 'فكرة: كثير الحدود عند اللانهاية', paper: '🧰 مهارة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['الحدّ الأعلى درجة هو الذي يقرّر', { t: '-x^3+x^2-x+1', tex: true }] },
    1: { rows: [{ t: '=x^3\\left(-1+\\frac1x-\\frac1{x^2}+\\frac1{x^3}\\right)', tex: true }, 'القوس $\\to-1$ ، فالتابع يتصرّف مثل $-x^3$'],
         side: [{ type: 'graph', xmin: -3, xmax: 3.5, ymin: -12, ymax: 12, h: 380, fns: [{ f: '-x*x*x+x*x-x+1', c: 'red' }, { f: '-x*x*x', c: 'blu', dash: true }], labels: [['$-x^3$', 2.6, -9, 'c', 'blu']] }] },
    2: { box: { t: 'الدرس الثالث: قواعد العمليّات على النهايات', c: 'pur' } },
  },
})
