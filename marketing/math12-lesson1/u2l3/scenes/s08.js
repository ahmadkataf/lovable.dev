solution('s08', {
  tag: 'مثال: كيف نستفيد من المبرهنات السابقة؟', ring: 'card',
  q: 'احسب نهاية التابع $h:x\\mapsto\\dfrac{x^2-x}{\\sin x}$ عند الصفر.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -1.6, xmax: 2.3, ymin: -4, ymax: 2.6, h: 380, yt: [-1], fns: [{ f: 'x==0?-1:(x*x-x)/sin(x)', from: -1.5, to: 2.2 }], pts: [[0, -1, 'o', 'yel']] }] },
    1: { rows: ['$x^2-x\\to0$ و $\\sin x\\to0$: حالة $\\frac00$'], box: { t: 'نبحث عن صيغة أخرى للتابع', c: 'yel' } },
    2: { rows: [{ t: 'h(x)=\\frac{x(x-1)}{\\sin x}=\\frac{x-1}{\\frac{\\sin x}{x}}=\\frac{u(x)}{v(x)}', tex: true }, '$u(x)=x-1$ ، $\\ v(x)=\\dfrac{\\sin x}{x}$'] },
    3: { page: true, rows: [{ t: '\\lim_{x\\to0}u(x)=-1,\\qquad\\lim_{x\\to0}v(x)=1', tex: true }], box: { t: '$\\lim_{x\\to0}h(x)=\\dfrac{-1}{1}=-1$', c: 'grn' } },
  },
})
