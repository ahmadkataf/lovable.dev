solution('s05', {
  tag: 'مثال: حلّ معادلة', ring: 'card',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R$ وفق $f(x)=x^3-2x^2-1$. \u2003 ① أثبت أنّ المعادلة $f(x)=0$ تقبل حلّاً وحيداً $c$ في المجال $[2,3]$.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -1.2, xmax: 3.3, ymin: -3.2, ymax: 8.5, h: 380, xt: [2, 3], yt: [[-1, '-1'], [8, '8']], fns: [{ f: 'x*x*x-2*x*x-1', from: -1.1, to: 3.25 }], pts: [[2, -1, 'c', 'yel'], [3, 8, 'c', 'yel']] }] },
    1: { rows: ['نتيقّن: مستمرّ ، مطّرد تماماً ، إشارتان مختلفتان', { t: 'f\'(x)=3x^2-4x=x(3x-4)', tex: true }] },
    2: { rows: [{ t: '\\begin{array}{c|ccccccccc}x&-\\infty&&0&&\\frac43&&2&&3\\\\\\hline f\'(x)&&+&0&-&0&+&&+&\\\\\\hline f(x)&-\\infty&\\nearrow&-1&\\searrow&-\\frac{59}{27}&\\nearrow&-1&\\nearrow&8\\end{array}', tex: true }] },
    3: { page: true, rows: ['$f$ متزايد تماماً على $[2,3]$ ، $f(2)=-1$ ، $f(3)=8$', { t: 'f(2)\\times f(3)<0', tex: true }], box: { t: 'حلّ وحيد $c\\in[2,3]$', c: 'grn' } },
    4: { rows: ['$f(x)<0$ على $]-\\infty,2]$ و $f(x)>0$ على $[3,+\\infty[$'], box: { t: '$c$ هو الحلّ الوحيد في $\\mathbb R$', c: 'grn' } },
  },
})
