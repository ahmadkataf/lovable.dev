solution('s06', {
  tag: '⓰', progress: '3 / 3',
  q: 'ليكن $\\mathcal C$ الخطّ البياني للتابع $f$ المعرّف بالعلاقة $f(x)=ax+b+\\dfrac{c}{x-d}$. جد الأعداد الحقيقيّة $a$ و $b$ و $c$ و $d$ علماً أنّ:<br>▪ المستقيم $x=3$ مقارب للخطّ $\\mathcal C$.   ▪ المستقيم $y=2x-5$ مقارب للخطّ $\\mathcal C$ عند $+\\infty$ وعند $-\\infty$.   ▪ تنتمي النقطة $A(1,2)$ إلى $\\mathcal C$.',
  beats: {
    1: { rows: ['المقارب الشاقولي حيث ينعدم المقام ← $d=3$ و $c\\ne0$'] },
    2: { rows: [{ t: 'f(x)-(2x-5)=(a-2)\\,x+(b+5)+\\dfrac{c}{x-d}\\to0', tex: true }, '← $a=2$ ،  $b=-5$'] },
    3: { page: true, rows: [{ t: 'f(1)=2-5+\\dfrac{c}{1-3}=2\\ \\Rightarrow\\ c=-10', tex: true }], box: { t: '$f(x)=2x-5-\\dfrac{10}{x-3}$', c: 'grn' }, side: [{ type: 'graph', xmin: -4, xmax: 10, ymin: -15, ymax: 20, h: 380, xt: [1, 3], yt: [2], fns: [{ f: '2*x-5', c: 'blu', dash: true }, { f: '2*x-5-10/(x-3)', n: 1000 }], vl: [[3, 'blu', '$x=3$']], pts: [[1, 2, 'c', 'yel']] }] },
  },
})
