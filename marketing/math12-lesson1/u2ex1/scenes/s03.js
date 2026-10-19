solution('s03', {
  tag: '❶ (①②)', progress: '1 / 3', head: '❶ ادرس في كلّ حالة نهاية التابع $f$ عند أطراف مجموعة تعريفه، وعند اللّزوم ادرس النهاية من اليمين ومن اليسار.',
  q: '① $f(x)=\\dfrac{x^3}{x^2+1}$     ② $f(x)=2-\\dfrac{4}{x^2}$',
  beats: {
    0: { side: [{ type: 'chip', t: 'الخطوة الأولى دائماً: $D_f$ وأطرافها', c: 'yel' }] },
    1: { rows: ['① $D_f=\\mathbb R$', { t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim_{x\\to\\pm\\infty}\\dfrac{x^3}{x^2}=\\lim_{x\\to\\pm\\infty}x=\\pm\\infty', tex: true }] },
    2: { page: true, rows: ['② $D_f=\\mathbb R^*$', { t: '\\lim_{x\\to\\pm\\infty}f(x)=2', tex: true }, { t: '\\lim_{x\\to0}\\dfrac{4}{x^2}=+\\infty\\ \\Rightarrow\\ \\lim_{x\\to0}f(x)=-\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -4, xmax: 4, ymin: -7, ymax: 4, h: 380, xt: [-2, 2], yt: [2], fns: [{ f: '2-4/(x*x)', n: 800 }], hl: [[2, 'blu', '$y=2$']] }], clear: true },
  },
})
