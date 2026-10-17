var U2L2_L = { xmin: -0.3, xmax: 5, ymin: -0.3, ymax: 4.5, h: 400, fns: [{ f: '1+3/(1+x*x/4)' }], xt: [[2, 'a']], yt: [[2.5, '\\ell']], pts: [[2, 2.5, 'c', 'yel']] }
solution('s06', {
  title: '2.2 النهاية عند $a$ هي عدد حقيقي $\\ell$', paper: '📘 تعريف 4', paperType: 'def',
  beats: {
    0: { rows: ['القيم $f(x)$ تتجمّع قرب $\\ell$ عندما تصبح $x$ قريبة بما يكفي من $a$', { t: '\\lim_{x\\to a}f(x)=\\ell', tex: true, cls2: 'ml' }], side: [{ type: 'graph', ...U2L2_L }] },
    1: { page: true, rows: ['مهما كان $\\varepsilon>0$: $\\ f(x)\\in\\,]\\ell-\\varepsilon,\\ell+\\varepsilon[$', 'عندما يكون بُعد $x\\in D_f$ عن $a$ أصغر من $\\delta$ ($\\delta$ يتعلّق بـ $\\varepsilon$)'] },
    2: { rows: ['شريط أفقي عرضه $2\\varepsilon$ ، وشريط شاقولي عرضه $2\\delta$'],
         side: [{ type: 'graph', ...U2L2_L, band: [2.1, 2.9, 'blu'], vband: [1.522, 2.478, 'yel'], xt: [[1.522, 'a-\\delta'], [2, 'a'], [2.478, 'a+\\delta']], yt: [[2.5, '\\ell']] }], clear: true },
    3: { page: true, rows: ['مهما كان $\\varepsilon>0$ ، توجد مجموعة $D_f\\cap\\,]a-\\delta,a+\\delta[$ ($\\delta>0$) عناصرها تحقّق:'], box: { t: '$\\left|f(x)-\\ell\\right|<\\varepsilon$', c: 'yel' } },
  },
})
