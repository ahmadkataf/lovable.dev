var U2X2_G = { type: 'graph', xmin: -1.3, xmax: 2.3, ymin: -3.2, ymax: 3, h: 380, xt: [1], yt: [-1, -2], fns: [{ f: '2*x*x*x-3*x*x-1' }] }
var U2X2_T = '\\begin{array}{c|ccccccc}x&-\\infty&&0&&1&&+\\infty\\\\\\hline f\'(x)&&+&0&-&0&+&\\\\\\hline f(x)&-\\infty&\\nearrow&-1&\\searrow&-2&\\nearrow&+\\infty\\end{array}'
solution('s04', {
  tag: '❺ (①②)', progress: '2 / 5',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R$ وفق $f(x)=2x^3-3x^2-1$ ، وليكن $\\mathcal C$ خطّه البياني المبيّن في الشكل.<br>① ادرس نهاية $f$ عند $-\\infty$ وعند $+\\infty$.   ② احسب $f\'(x)$ وادرس إشارته، ثمّ نظّم جدولاً بتغيّرات $f$.',
  beats: {
    0: { side: [U2X2_G] },
    1: { rows: [{ t: '\\lim_{x\\to-\\infty}f(x)=\\lim_{x\\to-\\infty}2x^3=-\\infty', tex: true }, { t: '\\lim_{x\\to+\\infty}f(x)=\\lim_{x\\to+\\infty}2x^3=+\\infty', tex: true }] },
    2: { page: true, rows: [{ t: "f'(x)=6x^2-6x=6x(x-1)", tex: true }, { t: 'f(0)=-1,\\qquad f(1)=2-3-1=-2', tex: true }] },
    3: { page: true, rows: [{ t: U2X2_T, tex: true }] },
  },
})
