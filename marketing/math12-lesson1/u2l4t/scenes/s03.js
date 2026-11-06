solution('s03', {
  tag: 'تدرَّبْ ❶ · ②', progress: '1 / 2', ring: 'card',
  q: '② أثبت أنّ $\\dfrac{-1}{x+1}\\le\\dfrac{\\cos x}{x+1}\\le\\dfrac{1}{x+1}$ أيّاً يكن $x>-1$. استنتج نهاية التابع $f:x\\mapsto\\dfrac{\\cos x}{x+1}$ عند $+\\infty$ ، ثُمّ ادرس بالمثل نهاية التابع ذاته عند $-\\infty$.',
  beats: {
    1: { rows: ['$-1\\le\\cos x\\le1$ ، و $x>-1$ ⟸ $x+1>0$ (الجهة نفسها)', { t: '\\frac{-1}{x+1}\\le\\frac{\\cos x}{x+1}\\le\\frac{1}{x+1}', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=0$', c: 'grn' } },
    2: { page: true, rows: ['$x<-1$ ⟸ $x+1<0$: تنقلب الجهة', { t: '\\frac{1}{x+1}\\le\\frac{\\cos x}{x+1}\\le\\frac{-1}{x+1}', tex: true }], box: { t: '$\\lim_{x\\to-\\infty}f(x)=0$', c: 'grn' },
         side: [{ type: 'graph', xmin: -14, xmax: 14, ymin: -1.2, ymax: 1.2, h: 300, fns: [{ f: 'cos(x)/(x+1)', from: -14, to: -2.2, n: 500 }, { f: 'cos(x)/(x+1)', from: -0.4, to: 14, n: 500 }, { f: '1/(x+1)', from: -14, to: -2, c: 'blu', dash: true }, { f: '-1/(x+1)', from: -14, to: -2, c: 'grn', dash: true }, { f: '1/(x+1)', from: 0, to: 14, c: 'blu', dash: true }, { f: '-1/(x+1)', from: 0, to: 14, c: 'grn', dash: true }] }] },
  },
})
