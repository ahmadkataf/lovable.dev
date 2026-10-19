solution('s03', {
  tag: 'تدرَّبْ ❷', progress: '2 / 7', ring: 'card',
  q: 'التابع $f$ معرّف على $\\mathbb R$ وفق $f(x)=x^3-3x^2+1$. علّلْ لماذا يكون للمعادلة $f(x)+1=0$ ثلاثة وفقط ثلاثة حلول حقيقيّة؟',
  beats: {
    0: { rows: ['$f(x)+1=0$ ⟺ $f(x)=-1$'] },
    1: { rows: [{ t: 'f\'(x)=3x(x-2)', tex: true }, { t: '\\begin{array}{c|ccccccc}x&-\\infty&&0&&2&&+\\infty\\\\\\hline f(x)&-\\infty&\\nearrow&1&\\searrow&-3&\\nearrow&+\\infty\\end{array}', tex: true }],
         side: [{ type: 'graph', xmin: -1.4, xmax: 3.4, ymin: -4, ymax: 3, h: 360, fns: [{ f: 'x*x*x-3*x*x+1', from: -1.3, to: 3.3 }], hl: [[-1, 'yel', '$y=-1$', 0]], pts: [[-0.732, -1, 'c', 'grn'], [1, -1, 'c', 'grn'], [2.732, -1, 'c', 'grn']] }] },
    2: { page: true, rows: [{ t: ']-\\infty,0]\\to\\,]-\\infty,1]\\ni-1,\\quad[0,2]\\to[-3,1]\\ni-1,\\quad[2,+\\infty[\\,\\to[-3,+\\infty[\\,\\ni-1', tex: true }], box: { t: 'حلّ وحيد في كلّ مجال ⟸ ثلاثة حلول فقط', c: 'grn' } },
  },
})
