solution('s03', {
  tag: '㉞ (①)', progress: '1 / 3', head: '㉞ مجموعة توابع مستمرّة',
  q: 'ليكن $m$ عدداً حقيقيّاً، وليكن $\\mathcal C_m$ الخطّ البياني للتابع $f_m$ المعرّف على $\\mathbb R$ وفق: $f_m(x)=x^3+mx^2-8x-m$<br>① a. أثبت أنّ الخطّين البيانيين $\\mathcal C_0$ و $\\mathcal C_1$ يتقاطعان في نقطتين $A$ و $B$. أوجد إحداثيّات هاتين النقطتين.  b. استنتج أنّ جميع الخطوط البيانيّة $\\mathcal C_m$ تمرّ بالنقطتين $A$ و $B$.',
  beats: {
    1: { rows: [{ t: 'f_0(x)=x^3-8x,\\qquad f_1(x)=x^3+x^2-8x-1', tex: true }, { t: 'f_1(x)-f_0(x)=x^2-1=0\\ \\Rightarrow\\ x=\\pm1', tex: true }] },
    2: { rows: [{ t: 'f_0(1)=-7,\\qquad f_0(-1)=7', tex: true }], box: { t: 'a. $A(1,-7)$ ،  $B(-1,7)$', c: 'grn' } },
    3: { page: true, rows: [{ t: 'f_m(x)=x^3-8x+m\\,(x^2-1)', tex: true }, '$x=\\pm1$: القوس $=0$ ← القيمة لا تتعلّق بـ $m$'], box: { t: 'b. كلّ $\\mathcal C_m$ تمرّ بـ $A$ و $B$', c: 'grn' }, side: [{ type: 'graph', xmin: -4.2, xmax: 4.2, ymin: -16, ymax: 16, h: 400, xt: [-1, 1], yt: [7, -7], fns: [-2, -1, 0, 1, 2].map((m, i) => ({ f: `x*x*x+(${m})*x*x-8*x-(${m})`, c: ['pur', 'blu', 'red', 'grn', 'yel'][i], w: 4 })), pts: [[1, -7, 'c', 'yel'], [-1, 7, 'c', 'yel']], labels: [['$A$', 1.5, -9.5, 'c', 'yel'], ['$B$', -1.5, 9.5, 'c', 'yel']] }] },
  },
})
