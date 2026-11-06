solution('s23', {
  tag: '④ · ❽', progress: '20 / 21', head: '④ ادرس جهة اطّراد كلٍّ من المتتاليات الآتية.',
  q: '❽ $\\begin{cases}u_0=1,\\\\ u_{n+1}=\\frac12u_n\\end{cases}$',
  beats: {
    1: { hint: 'مقارنة النسبة بالواحد — بعد إثبات $u_n>0$' },
    2: { rows: ['$n_0=0$. المتتالية هندسيّة أساسها $q=\\frac12$ وحدّها الأوّل $u_0=1$، إذن', { t: 'u_n=u_0\\,q^n=\\left(\\dfrac12\\right)^n=\\dfrac{1}{2^n}\\ \\textcolor{#6ee05a}{>0}\\quad\\text{أيّاً كان } n', tex: true }] },
    3: { rows: [{ t: '\\dfrac{u_{n+1}}{u_n}=\\dfrac12<1\\ \\Rightarrow\\ u_{n+1}<u_n\\quad(\\text{بالضرب بـ } \\textcolor{#6ee05a}{u_n>0})', tex: true }] },
    4: { box: { t: '$(u_n)_{n\\ge0}$ متتالية متناقصة تماماً', c: 'red' },
         rows: [{ t: 'طريقة أخرى: $u_{n+1}-u_n=\\frac12u_n-u_n=-\\frac12u_n=-\\left(\\frac12\\right)^{n+1}<0$', cls: 'blu' }],
         side: [{ type: 'plot', pts: [[0, 1], [1, .5], [2, .25], [3, .125]], c: 'red', xmin: 0, xmax: 4, ymin: 0, ymax: 1.15, labels: [['$1$', 0, 1, 'cl'], ['$\\frac12$', 1, .5, 'bc'], ['$\\frac14$', 2, .25, 'bc'], ['$\\frac18$', 3, .125, 'bc']] }], clear: true },
    5: { warn: ['لو كان $u_0=-1$: $-1,\\,-\\frac12,\\,-\\frac14,\\dots$ <span class="grn b">متزايدة</span> رغم $\\dfrac{u_{n+1}}{u_n}=\\dfrac12<1$', 'اكتب دائماً $u_n>0$ أوّلاً'] },
  },
})
