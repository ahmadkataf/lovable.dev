solution('s03', {
  tag: '❹', progress: '1 / 5',
  q: '$f$ هو التابع المعرّف على المجال $]1,+\\infty[$ وفق $f(x)=\\dfrac{2x+\\sin x}{x-1}$.<br>① أثبت أنّ $\\dfrac{2x-1}{x-1}\\le f(x)\\le\\dfrac{2x+1}{x-1}$ أيّاً يكن $x>1$.   ② استنتج نهاية $f$ عند $+\\infty$.',
  beats: {
    1: { rows: [{ t: '-1\\le\\sin x\\le1', tex: true }, { t: '2x-1\\le2x+\\sin x\\le2x+1', tex: true }, { t: '\\dfrac{2x-1}{x-1}\\le f(x)\\le\\dfrac{2x+1}{x-1}', tex: true }],
         side: [{ type: 'chip', t: '$x-1>0$: جهة المتباينة لا تتغيّر', c: 'yel' }] },
    2: { page: true, rows: [{ t: '\\lim_{x\\to+\\infty}\\dfrac{2x-1}{x-1}=\\lim_{x\\to+\\infty}\\dfrac{2x+1}{x-1}=2', tex: true }], box: { t: '② $\\lim_{x\\to+\\infty}f(x)=2$ (الإحاطة)', c: 'grn' },
         side: [{ type: 'graph', xmin: 0, xmax: 30, ymin: 0, ymax: 6, h: 380, xt: [1, 10, 20], yt: [2], fns: [{ f: '(2*x-1)/(x-1)', c: 'blu', dash: true, from: 1.05 }, { f: '(2*x+1)/(x-1)', c: 'grn', dash: true, from: 1.05 }, { f: '(2*x+sin(x))/(x-1)', from: 1.05, n: 800 }], hl: [[2, 'yel', '$y=2$']] }], clear: true },
  },
})
