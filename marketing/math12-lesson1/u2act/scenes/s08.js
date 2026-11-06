solution('s08', {
  title: 'نشاط 2 · ❸ حالة $h<0$ والنهاية', paper: '🧪 نشاط 2', paperType: 'think',
  beats: {
    0: { rows: ['$h\'=-h\\in\\left]0,\\frac\\pi2\\right[$: $\\ \\cos h\'\\le\\dfrac{\\sin h\'}{h\'}\\le1$', { t: '\\frac{\\sin(-h)}{-h}=\\frac{\\sin h}{h},\\qquad\\cos(-h)=\\cos h', tex: true }] },
    1: { rows: ['أيّاً كان $h\\ne0$ من $\\left]-\\frac\\pi2,\\frac\\pi2\\right[$:'], box: { t: '$\\cos h\\le\\dfrac{\\sin h}{h}\\le1$', c: 'yel' } },
    2: { page: true, rows: [{ t: '\\lim_{h\\to0}\\cos h=1', tex: true }], box: { t: '$\\lim_{h\\to0}\\dfrac{\\sin h}{h}=1$ (الإحاطة)', c: 'grn' },
         side: [{ type: 'graph', xmin: -1.7, xmax: 1.7, ymin: -0.1, ymax: 1.2, h: 360, yt: [1], fns: [{ f: 'cos(x)', c: 'blu' }, { f: '1+0*x', c: 'grn' }, { f: 'x==0?1:sin(x)/x', c: 'red' }] }] },
  },
})
