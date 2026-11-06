solution('s08', {
  tag: 'تدرَّبْ ❼', progress: '7 / 7', ring: 'card',
  q: 'نتأمّل $f(x)=x-\\cos x$. ① احسب $f(0)$ و $f(\\frac\\pi2)$ واستنتج وجود $\\alpha$ يحقّق $f(\\alpha)=0$. ② اشرح لماذا كلّ حلّ يجب أن ينتمي إلى $[-1,1]$. ③ استنتج أنّه ينتمي إلى $]0,1[$. ④ برهن أنّ $x\\mapsto x-\\cos x$ متزايد تماماً على $]0,1[$ ، واستنتج أنّ للمعادلة $f(x)=0$ حلّاً حقيقيّاً وحيداً $\\alpha\\in\\,]0,1[$.',
  beats: {
    1: { rows: [{ t: 'f(0)=-1<0,\\qquad f\\left(\\tfrac\\pi2\\right)=\\tfrac\\pi2>0', tex: true }, '$f$ مستمرّ ⟸ يوجد $\\alpha$ (القيمة الوسطى)'] },
    2: { rows: ['$f(x)=0$ ⟺ $x=\\cos x\\in[-1,1]$'] },
    3: { page: true, rows: ['$x\\in[-1,0]$: $\\cos x>0\\ge x$ ، و $\\cos1\\ne1$'], box: { t: 'كلّ حلّ في $]0,1[$', c: 'yel' },
         side: [{ type: 'graph', xmin: -1.3, xmax: 1.6, ymin: -1.3, ymax: 1.6, h: 360, xt: [-1, 1], fns: [{ f: 'cos(x)', c: 'blu' }, { f: 'x', c: 'red' }], pts: [[0.739, 0.739, 'c', 'yel']], labels: [['$\\cos x$', -0.9, 0.9, 'c', 'blu'], ['$y=x$', 1.3, 1.45, 'c', 'red']] }] },
    4: { rows: ['$f\'(x)=1+\\sin x>0$ على $]0,1[$'], box: { t: 'حلّ وحيد $\\alpha\\in\\,]0,1[$ ($\\alpha\\approx0.739$)', c: 'grn' } },
  },
})
