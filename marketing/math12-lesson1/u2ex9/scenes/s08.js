solution('s08', {
  tag: '㉜ (②③)', progress: '5 / 6',
  q: '② نرمز بالرمز $g$ إلى التابع المعرّف على $[0,\\pi]$ وفق $g(x)=\\sin x-\\tfrac12x$.  a. احسب $g\'(x)$ وأثبت أنّ $g\'(x)$ ينعدم عند $x=\\tfrac\\pi3$.  b. نظّم جدولاً بتغيّرات $g$.<br>③ استنتج ممّا سبق أنّ المعادلة $\\sin x=\\tfrac12x$ تقبل حلّاً وحيداً $\\alpha$ في المجال $]0,\\pi]$.',
  beats: {
    1: { rows: [{ t: "g'(x)=\\cos x-\\tfrac12,\\qquad g'\\big(\\tfrac\\pi3\\big)=\\tfrac12-\\tfrac12=0", tex: true }, '$\\cos$ متناقص على $[0,\\pi]$: $g\'>0$ قبل $\\tfrac\\pi3$ ،  $g\'<0$ بعدها'] },
    2: { page: true, rows: [{ t: 'g(0)=0,\\quad g\\big(\\tfrac\\pi3\\big)=\\tfrac{\\sqrt3}2-\\tfrac\\pi6\\approx0.34,\\quad g(\\pi)=-\\tfrac\\pi2', tex: true }, { t: '\\begin{array}{c|ccccc}x&0&&\\frac\\pi3&&\\pi\\\\\\hline g\'(x)&&+&0&-&\\\\\\hline g(x)&0&\\nearrow&0.34&\\searrow&-\\frac\\pi2\\end{array}', tex: true }] },
    3: { page: true, rows: ['على $]0,\\tfrac\\pi3]$: $g(x)>g(0)=0$ ← لا حلّ', 'على $[\\tfrac\\pi3,\\pi]$: مستمرّ ومتناقص تماماً من موجب إلى سالب ← حلّ وحيد'], box: { t: 'حلّ وحيد $\\alpha\\in\\,]0,\\pi]$', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.2, xmax: 3.4, ymin: -1.7, ymax: 0.6, h: 360, xt: [[1.0472, '\\tfrac\\pi3'], [3.1416, '\\pi']], yt: [], fns: [{ f: 'sin(x)-x/2', from: 0, to: 3.1416 }], pts: [[1.0472, 0.3424, 'c', 'yel'], [1.8955, 0, 'c', 'grn']], labels: [['$\\alpha$', 2.05, 0.25, 'c', 'grn']] }] },
  },
})
