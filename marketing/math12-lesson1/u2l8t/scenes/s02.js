solution('s02', {
  tag: 'تدرَّبْ ❶', progress: '1 / 7', ring: 'card',
  q: 'التابع $f$ معرّف على $\\mathbb R$ وفق $f(x)=x^3-x^2+x-2$. علّلْ لماذا يكون للمعادلة $f(x)=0$ حلٌّ وحيد في المجال $]1,2[$؟',
  beats: {
    1: { rows: [{ t: 'f\'(x)=3x^2-2x+1,\\qquad\\Delta=4-12<0\\ \\Rightarrow\\ f\'(x)>0', tex: true }, '$f$ مستمرّ ومتزايد تماماً'] },
    2: { rows: [{ t: 'f(1)=-1<0,\\qquad f(2)=4>0', tex: true }], box: { t: 'حلّ وحيد في $]1,2[$', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.3, xmax: 2.4, ymin: -2.5, ymax: 5, h: 360, xt: [1, 2], fns: [{ f: 'x*x*x-x*x+x-2', from: 0, to: 2.3 }], pts: [[1, -1, 'c', 'yel'], [2, 4, 'c', 'yel'], [1.3532, 0, 'c', 'grn']] }] },
  },
})
