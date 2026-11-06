solution('s02', {
  title: 'أفكار يجب تمثّلها (1)', paper: '💡 أفكار', paperType: 'def',
  beats: {
    0: { rows: ['العمليّات على النهايات: مجموع، جداء، خارج قسمة', 'حالات عدم التعيين:', { t: '+\\infty-\\infty,\\qquad0\\times\\pm\\infty,\\qquad\\frac00,\\qquad\\frac{\\pm\\infty}{\\pm\\infty}', tex: true }] },
    1: { page: true, rows: ['$f\\ge g$ و $g\\to+\\infty$ ⟸ $f\\to+\\infty$', '$f\\le g$ و $g\\to-\\infty$ ⟸ $f\\to-\\infty$'] },
    2: { rows: ['$g\\le f\\le h$ و $g,h\\to\\ell$ ⟸ $f\\to\\ell$'], box: { t: '$\\ell$: عدد حقيقي أو $+\\infty$ أو $-\\infty$', c: 'yel' } },
  },
})
