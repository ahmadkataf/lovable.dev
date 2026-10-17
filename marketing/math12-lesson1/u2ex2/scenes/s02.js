solution('s02', {
  title: 'تذكير سريع', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['① الإحاطة: $g\\le f\\le h$ و $\\lim g=\\lim h=\\ell$ ← $\\lim f=\\ell$', { t: '\\lim_{x\\to0}\\dfrac{\\sin x}{x}=1', tex: true }] },
    1: { page: true, rows: [{ t: "\\lim_{x\\to a}\\dfrac{f(x)-f(a)}{x-a}=f'(a)", tex: true }, '$\\sqrt{x^2}=|x|$ :  $x$ إذا $x>0$ ،  $-x$ إذا $x<0$'], box: { t: 'انتبه عند $-\\infty$: $\\sqrt{x^2}=-x$', c: 'red' } },
  },
})
