solution('s04', {
  title: '3.7 استمرار التوابع المرجعيّة', paper: '⭐ توابع مستمرّة', paperType: 'tip',
  beats: {
    0: { rows: ['① $\\sqrt x$: اشتقاقي على $]0,+\\infty[$ ، و $\\lim_{x\\to0}\\sqrt x=0=f(0)$'], box: { t: '$\\sqrt x$ مستمرّ على $[0,+\\infty[$', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.5, xmax: 6, ymin: -0.4, ymax: 3, h: 340, grid: 1, fns: [{ f: 'sqrt(x)', from: 0 }], pts: [[0, 0, 'c']] }] },
    1: { page: true, rows: ['② كثيرات الحدود: مستمرّة على $\\mathbb R$', '③ التوابع الكسريّة: مستمرّة على مجموعة تعريفها', '④ $\\sin$ و $\\cos$: مستمرّان على $\\mathbb R$'] },
    2: { box: { t: 'عمليّات جبريّة + تركيب ⟸ توابع مستمرّة على مجموعات تعريفها', c: 'grn' } },
  },
})
