solution('s02', {
  title: 'تذكير: القسمة على عدد صغير', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: '\\frac1{0.1}=10,\\qquad\\frac1{0.001}=1000,\\qquad\\frac1{-0.001}=-1000', tex: true }] },
    1: { rows: ['البسط $\\to$ عدد غير معدوم ، المقام $\\to0$'], box: { t: '$\\left|\\text{الكسر}\\right|\\to+\\infty$ ، والإشارة من إشارتي البسط والمقام', c: 'yel' } },
    2: { page: true, rows: [{ t: '|x|=\\begin{cases}x,&x\\ge0\\\\-x,&x<0\\end{cases}', tex: true, cls2: 'ml' }] },
  },
})
