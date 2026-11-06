solution('s07', {
  tag: 'تدرَّبْ ❻', progress: '6 / 7', ring: 'card',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R$ وفق $f(x)=1+3x-x^3$. ① ادرس نهاية $f$ عند $-\\infty$ وعند $+\\infty$. ② احسب $f\'(x)$ وادرس إشارته، ثمّ نظّم جدولاً بتغيّرات $f$. ③ أثبت أنّ المعادلة $f(x)=0$ تقبل ثلاثة جذور فقط، ينتمي كلّ منها إلى واحد من المجالات $[-2,-1]$ و $[-1,1]$ و $[1,2]$.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to-\\infty}f(x)=+\\infty,\\qquad\\lim_{x\\to+\\infty}f(x)=-\\infty', tex: true }, { t: 'f\'(x)=3-3x^2=3(1-x)(1+x)', tex: true }] },
    2: { rows: [{ t: '\\begin{array}{c|ccccccc}x&-\\infty&&-1&&1&&+\\infty\\\\\\hline f\'(x)&&-&0&+&0&-&\\\\\\hline f(x)&+\\infty&\\searrow&-1&\\nearrow&3&\\searrow&-\\infty\\end{array}', tex: true }] },
    3: { page: true, rows: [{ t: 'f(-2)=3,\\quad f(-1)=-1,\\quad f(1)=3,\\quad f(2)=-1', tex: true }, 'في كلّ مجال: مستمرّ، مطّرد تماماً، إشارتان مختلفتان'],
         side: [{ type: 'graph', xmin: -2.4, xmax: 2.4, ymin: -2, ymax: 4, h: 360, xt: [-2, -1, 1, 2], fns: [{ f: '1+3*x-x*x*x', from: -2.3, to: 2.3 }], pts: [[-1.532, 0, 'c', 'grn'], [-0.347, 0, 'c', 'grn'], [1.879, 0, 'c', 'grn']] }] },
    4: { rows: ['$x<-2$: $f(x)>3$ ، $\\ x>2$: $f(x)<-1$'], box: { t: 'ثلاثة جذور فقط', c: 'grn' } },
  },
})
