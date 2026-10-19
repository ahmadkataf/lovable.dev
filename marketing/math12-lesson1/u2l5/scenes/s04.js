solution('s04', {
  tag: 'مثال', ring: 'card',
  q: '① ابحث عن نهاية التابع $f:x\\mapsto\\sqrt{x^2-x+1}$ عند $+\\infty$.   ② نتأمّل التابع المعطى على المجال $\\left]\\tfrac13,+\\infty\\right[$ بالعلاقة $f(x)=\\dfrac{1}{\\sqrt{3x-1}}$. ما نهاية هذا التابع عندما تسعى $x$ إلى $\\tfrac13$؟',
  beats: {
    1: { rows: ['① $X=h(x)=x^2-x+1$ ، $f(x)=\\sqrt X$', { t: '\\lim_{x\\to+\\infty}h(x)=+\\infty,\\quad\\lim_{X\\to+\\infty}\\sqrt X=+\\infty', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=+\\infty$', c: 'grn' } },
    2: { page: true, rows: ['② $X=h(x)=3x-1>0$ ، $f(x)=\\dfrac1{\\sqrt X}$', { t: '\\lim_{x\\to\\frac13}h(x)=0,\\quad\\lim_{X\\to0}\\frac1{\\sqrt X}=+\\infty', tex: true }], box: { t: '$\\lim_{x\\to\\frac13}f(x)=+\\infty$', c: 'grn' } },
    3: { rows: ['$X=h(x)$: «غيّرنا المتحوّل» = ركّبنا تابعين'] },
  },
})
