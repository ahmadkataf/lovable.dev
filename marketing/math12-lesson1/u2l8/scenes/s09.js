solution('s09', {
  title: '3.8 مفهوم التابع العكسي', paper: '📘 تعريف', paperType: 'def',
  beats: {
    0: { rows: ['$f$ مستمرّ ومطّرد تماماً على $I$ ، $J=f(I)$ (مجال):', '◆ $x\\in I$ ⟸ $f(x)\\in J$', '◆ أيّاً يكن $y\\in J$: عدد واحد فقط $x\\in I$ يحقّق $f(x)=y$'] },
    1: { rows: [], box: { t: '$f$ تقابل من $I$ إلى $J$ ، و $g(y)=x$ حيث $x$ حلّ $f(x)=y$', c: 'yel' },
         side: [{ type: 'tex', t: 'I\\ni x\\quad\\underset{g}{\\overset{f}{\\rightleftarrows}}\\quad y\\in J', cls: 'ml' }] },
    2: { page: true, rows: ['$g$ التابع العكسي (التقابل العكسي) لـ $f$'], box: { t: '$g=f^{-1}$', c: 'grn' } },
    3: { rows: [{ t: 'g\\big(f(x)\\big)=x,\\qquad f\\big(g(y)\\big)=y', tex: true }, 'و $f$ هو العكسي لـ $g$: $\\ g^{-1}=f$'] },
  },
})
