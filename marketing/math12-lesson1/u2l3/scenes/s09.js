solution('s09', {
  tag: 'مثال: إزالة عدم تعيين', ring: 'card',
  q: 'احسب نهاية التابع $f:x\\mapsto\\dfrac{\\sqrt{x+1}-1}{x}$ عند $0$.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -1.2, xmax: 4.2, ymin: -0.2, ymax: 1.3, h: 360, yt: [[0.5, '\\tfrac12'], 1], fns: [{ f: 'x==0?0.5:(sqrt(x+1)-1)/x', from: -1, to: 4 }], pts: [[0, 0.5, 'o', 'yel']] }] },
    1: { rows: ['البسط $\\to0$ والمقام $\\to0$: حالة $\\frac00$ ⟸ نضرب بالمرافق $\\sqrt{x+1}+1$'] },
    2: { rows: [{ t: 'f(x)=\\frac{(\\sqrt{x+1}-1)(\\sqrt{x+1}+1)}{x(\\sqrt{x+1}+1)}=\\frac{x+1-1}{x(\\sqrt{x+1}+1)}=\\frac{1}{\\sqrt{x+1}+1}', tex: true }],
         box: { t: '$\\lim_{x\\to0}(\\sqrt{x+1}+1)=2$ ⟸ $\\lim_{x\\to0}f(x)=\\dfrac12$', c: 'grn' } },
  },
})
