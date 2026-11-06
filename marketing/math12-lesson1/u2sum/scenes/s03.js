solution('s03', {
  title: 'أفكار يجب تمثّلها (2)', paper: '💡 أفكار', paperType: 'def',
  beats: {
    0: { rows: ['$g\\big(h(x)\\big)$ عند $a$: $\\ b=\\lim_{x\\to a}h(x)$ ، ثمّ نهاية $g$ عند $b$'] },
    1: { page: true, rows: ['تغيير المتحوّل:', { t: 'f(x)=\\left(\\frac{4x+1}{x-1}\\right)^{5/2}-3\\left(\\frac{4x+1}{x-1}\\right)^{3/2}', tex: true }] },
    2: { rows: [{ t: 'u(x)=\\sqrt{\\frac{4x+1}{x-1}}\\to2,\\qquad\\lim_{x\\to+\\infty}f(x)=\\lim_{u\\to2}(u^5-3u^3)=32-24=8', tex: true }] },
    3: { page: true, rows: ['استمرار $f$ عند $a$: نحسب $\\lim_{x\\to a}f(x)$ و $f(a)$', 'التوابع الاشتقاقيّة توابع مستمرّة'] },
  },
})
