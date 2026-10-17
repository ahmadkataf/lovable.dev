var U2L4_B = { xmin: -0.5, xmax: 20, ymin: -3, ymax: 13, h: 380, fns: [{ f: 'x/2+2*sin(x)', c: 'red', n: 600 }, { f: 'x/2-2', c: 'grn', dash: true }, { f: 'x/2+2', c: 'blu', dash: true }],
  labels: [['$y=\\frac x2+2$', 13, 11.2, 'c', 'blu'], ['$y=\\frac x2-2$', 16, 3.6, 'c', 'grn']] }
solution('s10', {
  title: 'تكريساً للفهم: ماذا تعطينا الإحاطة أيضاً؟', paper: '🧠 فكّر', paperType: 'think',
  beats: {
    0: { rows: ['① قيم تقريبيّة للتابع عندما $x$ في غاية الكبر', '② سلوك الفرع اللانهائي للخطّ البياني'] },
    1: { page: true, rows: [{ t: 'f(x)=\\frac x2+2\\sin x', tex: true }, { t: '\\frac x2-2\\le f(x)\\le\\frac x2+2', tex: true }], side: [{ type: 'graph', ...U2L4_B }] },
    2: { rows: [{ t: '\\lim_{x\\to+\\infty}\\left(\\frac x2-2\\right)=+\\infty', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=+\\infty$ (المبرهنة 3)', c: 'grn' } },
    3: { page: true, rows: ['① $\\frac x2$ قيمة تقريبيّة لـ $f(x)$ بخطأ $2$ زيادة أو نقصاناً', { t: '498\\le f(1000)\\le502', tex: true }] },
    4: { rows: ['② الخطّ البياني يتموّج بين المستقيمين $y=\\frac x2-2$ و $y=\\frac x2+2$'], side: [{ type: 'graph', ...U2L4_B, fns: [...U2L4_B.fns] }], clear: true },
  },
})
