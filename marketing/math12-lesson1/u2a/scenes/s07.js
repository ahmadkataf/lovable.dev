solution('s07', {
  title: 'نشاط 2: تابع الجزء الصحيح', paper: '📘 تعريف', paperType: 'def',
  beats: {
    0: { rows: ['أيّاً يكن $x\\in\\mathbb R$ ، يوجد عدد صحيح وحيد $n$ يحقّق:', { t: 'n\\le x<n+1', tex: true, cls2: 'ml' }] },
    1: { rows: ['$n$ هو الجزء الصحيح للعدد $x$ ، ونكتب $E(x)$', 'أي: أكبر عدد صحيح لا يتجاوز $x$', { t: 'E(\\pi)=3\\qquad(3\\le\\pi<4)', tex: true }],
         side: [{ type: 'graph', xmin: 1.5, xmax: 5.5, ymin: -1, ymax: 1, h: 150, ax: ['', ''], xt: [2, 3, 4, 5], pts: [[3.1416, 0, 'c', 'yel']], labels: [['$\\pi$', 3.1416, 0.6, 'c', 'yel']] }] },
    2: { rows: [{ t: 'E(-3.5)=-4\\qquad(-4\\le-3.5<-3)', tex: true }], warn: ['$E(-3.5)\\ne-3$ !', 'نذهب دائماً إلى العدد الصحيح الأصغر'] },
  },
})
