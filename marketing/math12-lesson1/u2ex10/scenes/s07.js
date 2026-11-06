var U2X10_H = { type: 'graph', xmin: -4, xmax: 4, ymin: -4.5, ymax: 4.5, h: 400, xt: [], yt: [1, -1], fns: [{ f: 'x', c: 'blu', dash: true }, { f: '-x', c: 'grn', dash: true }, { f: 'sqrt(1+x*x)' }, { f: '-sqrt(1+x*x)', c: 'pur' }], labels: [['$\\mathcal C$', 2.6, 3.6, 'c', 'red'], ["$\\mathcal C'$", 2.6, -3.6, 'c', 'pur']] }
solution('s07', {
  tag: '㊱ (④)', progress: '3 / 3',
  q: '④ ليكن $\\mathcal C\'$ الخطّ البياني للتابع $g$ المعرّف على $\\mathbb R$ وفق $g(x)=-f(x)$ ، وليكن $\\mathcal H=\\mathcal C\\cup\\mathcal C\'$. أثبت أنّ معادلة $\\mathcal H$ هي $y^2-x^2=1$.',
  beats: {
    1: { rows: ['$M(x,y)\\in\\mathcal H$ ⟺ $y=\\sqrt{1+x^2}$ أو $y=-\\sqrt{1+x^2}$', '⟺ $y^2=1+x^2$ ⟺ $y^2-x^2=1$'], box: { t: '$\\mathcal H:\\ y^2-x^2=1$', c: 'grn' } },
    2: { rows: ['متناظر بالنسبة إلى المحورين وإلى $O$', 'مقارباه: $y=x$ و $y=-x$'], side: [U2X10_H] },
  },
})
