solution('s10', {
  tag: 'تدرَّبْ ④', progress: '2 / 3', ring: 'card',
  q: '④ ليكن $g$ مقصور التابع $f$ على المجال $[0,\\pi]$. أثبت أنّ $g$ اشتقاقي وارسم خطّه البياني.',
  beats: {
    1: { rows: [{ t: 'g(x)=\\sqrt{2\\sin^2\\tfrac x2}=\\sqrt2\\,\\left|\\sin\\tfrac x2\\right|', tex: true }] },
    2: { rows: ['$0\\le\\frac x2\\le\\frac\\pi2$ ⟸ $\\sin\\frac x2\\ge0$', { t: 'g(x)=\\sqrt2\\sin\\frac x2,\\qquad g\'(x)=\\frac{\\sqrt2}{2}\\cos\\frac x2', tex: true }], box: { t: '$g$ اشتقاقي على $[0,\\pi]$', c: 'grn' } },
    3: { rows: ['$g\'\\ge0$: متزايد من $0$ إلى $\\sqrt2$'],
         side: [{ type: 'graph', xmin: -0.4, xmax: 3.8, ymin: -0.3, ymax: 1.8, h: 340, xt: [[3.1416, '\\pi']], yt: [[1.4142, '\\sqrt2']], fns: [{ f: 'sqrt(2)*sin(x/2)', from: 0, to: 3.1416 }] }] },
  },
})
