solution('s10', {
  tag: 'مثال: إزالة عدم تعيين', ring: 'card',
  q: 'احسب نهاية التابع $f:x\\mapsto\\dfrac{x+\\sqrt x}{x+1}$ عند $+\\infty$.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -1, xmax: 40, ymin: -0.1, ymax: 1.4, h: 360, yt: [1], fns: [{ f: '(x+sqrt(x))/(x+1)', from: 0, to: 40 }], hl: [[1, 'blu', '$y=1$']] }] },
    1: { rows: ['حالة $\\frac{+\\infty}{+\\infty}$ ⟸ نُخرج $x$ عاملاً مشتركاً ($x>0$)', { t: 'f(x)=\\frac{x\\left(1+\\frac{\\sqrt x}{x}\\right)}{x\\left(1+\\frac1x\\right)}=\\frac{1+\\frac{1}{\\sqrt x}}{1+\\frac1x}', tex: true }] },
    2: { rows: [{ t: '\\lim_{x\\to+\\infty}\\frac1x=0,\\qquad\\lim_{x\\to+\\infty}\\frac1{\\sqrt x}=0', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=1$', c: 'grn' } },
  },
})
