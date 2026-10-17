solution('s09', {
  tag: '❿', progress: '2 / 2',
  q: 'ليكن $g$ التابع المعرّف على $\\mathbb R$ وفق $g(x)=\\dfrac{1}{3+2\\sin x}$.<br>① أثبت أنّ $g$ محدود.   ② استنتج كلّاً من النهايتين $\\lim_{x\\to+\\infty}\\dfrac{x+\\sin x}{3+2\\sin x}$ و $\\lim_{x\\to+\\infty}\\dfrac{x^2}{3+2\\sin x}$.',
  beats: {
    1: { rows: [{ t: '-1\\le\\sin x\\le1\\ \\Rightarrow\\ 1\\le3+2\\sin x\\le5', tex: true }, { t: '\\dfrac15\\le g(x)\\le1', tex: true }], box: { t: '① $g$ محدود', c: 'grn' },
         side: [{ type: 'graph', xmin: -10, xmax: 10, ymin: -0.2, ymax: 1.3, h: 320, xt: [], yt: [[0.2, '\\tfrac15'], 1], fns: [{ f: '1/(3+2*sin(x))', n: 800 }], band: [0.2, 1, 'grn'] }] },
    2: { page: true, rows: [{ t: '\\dfrac{x+\\sin x}{3+2\\sin x}=(x+\\sin x)\\,g(x)\\ \\ge\\ \\dfrac{x-1}{5}\\qquad(x>1)', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}\\dfrac{x+\\sin x}{3+2\\sin x}=+\\infty$', c: 'grn' } },
    3: { rows: [{ t: '\\dfrac{x^2}{3+2\\sin x}=x^2\\,g(x)\\ \\ge\\ \\dfrac{x^2}{5}', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}\\dfrac{x^2}{3+2\\sin x}=+\\infty$', c: 'grn' } },
  },
})
