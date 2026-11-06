solution('s06', {
  title: 'مستمرّ… دون أن يكون اشتقاقيّاً', paper: '✏️ مثال', paperType: 'ex',
  beats: {
    0: { rows: ['اشتقاقي ⟸ مستمرّ ✓', 'مستمرّ ⟸ اشتقاقي ✗ (ليس بالضرورة)'] },
    1: { page: true, rows: [{ t: '\\frac{f(x)-f(0)}{x-0}=\\frac{\\sqrt x}{x}=\\frac1{\\sqrt x}\\ \\Rightarrow\\ \\lim_{x\\to0}\\frac{f(x)-f(0)}{x-0}=+\\infty', tex: true }], box: { t: '$\\sqrt x$ مستمرّ عند $0$ ، لكنّه غير اشتقاقي عنده', c: 'yel' },
         side: [{ type: 'graph', xmin: -0.5, xmax: 6, ymin: -0.4, ymax: 3, h: 340, grid: 1, fns: [{ f: 'sqrt(x)', from: 0 }], vl: [[0, 'yel', '', 0]] }] },
    2: { rows: ['مماسّ «شاقولي» في المبدأ'] },
  },
})
