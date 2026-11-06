var U2L8_Z = { xmin: 1.9, xmax: 2.36, ymin: -1.3, ymax: 0.6, h: 380, ax: ['', ''], xt: [[2, '2'], [2.1975, '\\beta'], [2.25, '\\alpha']], fns: [{ f: 'x*x*x-2*x*x-1', from: 1.9, to: 2.36 }] }
solution('s06', {
  tag: 'مثال: الاقتراب من الحلّ', ring: 'card',
  q: '② اكتب معادلة المماس $T$ في النقطة $M$ التي فاصلتها $2$ ، وعيّن $\\alpha$ فاصلة تقاطع $T$ مع محور الفواصل. ③ اكتب معادلة المستقيم $S$ المارّ بـ $M$ و $N(\\alpha,f(\\alpha))$ ، وعيّن $\\beta$ فاصلة تقاطعه مع محور الفواصل. ④ رتّب $\\alpha$ ، $\\beta$ ، $c$ تصاعديّاً، واستنتج مجالاً يحصر $c$.',
  beats: {
    1: { rows: [{ t: 'T:\\ y=f\'(2)(x-2)+f(2)=4x-9\\ \\Rightarrow\\ \\alpha=\\frac94', tex: true }], side: [{ type: 'graph', ...U2L8_Z, fns: [...U2L8_Z.fns, { f: '4*x-9', c: 'blu', dash: true }], pts: [[2, -1, 'c', 'yel'], [2.25, 0, 'c', 'blu']], labels: [['$T$', 2.32, 0.5, 'c', 'blu'], ['$M$', 2.02, -1.12, 'c', 'yel']] }] },
    2: { page: true, rows: [{ t: 'f\\left(\\tfrac94\\right)=\\tfrac{17}{64},\\qquad S:\\ y=\\tfrac{81}{16}x-\\tfrac{89}{8}', tex: true }, { t: '\\beta=\\tfrac{178}{81}\\approx2.1975', tex: true }],
         side: [{ type: 'graph', ...U2L8_Z, fns: [...U2L8_Z.fns, { f: '4*x-9', c: 'blu', dash: true }, { f: '81/16*x-89/8', c: 'grn', dash: true }], pts: [[2, -1, 'c', 'yel'], [2.25, 0.2656, 'c', 'grn'], [2.1975, 0, 'c', 'grn']], labels: [['$N$', 2.27, 0.42, 'c', 'grn'], ['$S$', 2.34, 0.4, 'c', 'grn']] }], clear: true },
    3: { rows: [{ t: 'f(\\alpha)=\\tfrac{17}{64}>0,\\quad f(\\beta)=-\\tfrac{24497}{81^3}<0', tex: true }], box: { t: '$\\beta<c<\\alpha$ ، أي $c\\in\\,]2.197,\\,2.25[$ ($c\\approx2.206$)', c: 'grn' } },
  },
})
