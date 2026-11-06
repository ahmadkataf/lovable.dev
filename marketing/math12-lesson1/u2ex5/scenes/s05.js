solution('s05', {
  tag: '⓯', progress: '2 / 3',
  q: 'ليكن $g$ التابع المعرّف على المجال $]3,+\\infty[$ وفق $g(x)=\\dfrac{3x-1}{x-3}$.<br>① احسب $\\lim_{x\\to+\\infty}g(x)$ واستنتج $\\lim_{x\\to+\\infty}g\\big(g(x)\\big)$.   ② أعِدّ حساب $\\lim_{x\\to+\\infty}g\\big(g(x)\\big)$ بعد كتابة $g\\big(g(x)\\big)$ بدلالة $x$.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to+\\infty}g(x)=3', tex: true }, { t: 'g(x)-3=\\dfrac{8}{x-3}>0\\ \\Rightarrow\\ g(x)\\to3^+', tex: true }],
         side: [{ type: 'graph', xmin: 2, xmax: 20, ymin: 0, ymax: 12, h: 360, xt: [3], yt: [3], fns: [{ f: '(3*x-1)/(x-3)', from: 3.02, n: 800 }], hl: [[3, 'grn', '$y=3$']], vl: [[3, 'blu', '']] }] },
    2: { rows: [{ t: '\\lim_{X\\to3^+}\\dfrac{3X-1}{X-3}=+\\infty', tex: true }], box: { t: '① $\\lim_{x\\to+\\infty}g\\big(g(x)\\big)=+\\infty$', c: 'grn' } },
    3: { page: true, rows: [{ t: '3g(x)-1=\\dfrac{8x}{x-3},\\qquad g(x)-3=\\dfrac{8}{x-3}', tex: true }, { t: 'g\\big(g(x)\\big)=\\dfrac{8x}{x-3}\\times\\dfrac{x-3}{8}=x', tex: true }], box: { t: '② $\\lim_{x\\to+\\infty}g\\big(g(x)\\big)=\\lim_{x\\to+\\infty}x=+\\infty$ ✓', c: 'grn' } },
  },
})
