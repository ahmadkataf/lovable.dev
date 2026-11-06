solution('s12', {
  tag: 'تدرَّبْ ❶', progress: '1 / 2', ring: 'card',
  q: 'احسب نهايات التوابع الآتية عند $+\\infty$ وعند $-\\infty$ وعند النقطة $a$ المعطاة، ويمكن في حالة عدم وجود النهاية حساب النهاية من اليمين والنهاية من اليسار عند $a$.<br>① $f(x)=\\dfrac{x-3}{x-1},\\ a=1$   ② $f(x)=\\dfrac{x^2+2}{x-2},\\ a=2$   ③ $f(x)=\\dfrac{2x-1}{x+1},\\ a=-1$',
  beats: {
    1: { rows: [{ t: '\\frac{x-3}{x-1}=\\frac{1-\\frac3x}{1-\\frac1x}\\ \\Rightarrow\\ \\lim_{x\\to\\pm\\infty}f(x)=1', tex: true }] },
    2: { rows: [{ t: 'x\\to1:\\ \\ x-3\\to-2,\\quad\\lim_{x\\to1^+}f(x)=-\\infty,\\quad\\lim_{x\\to1^-}f(x)=+\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -4, xmax: 6, ymin: -6, ymax: 7, h: 300, fns: [{ f: '(x-3)/(x-1)', from: -4, to: 0.7 }, { f: '(x-3)/(x-1)', from: 1.28, to: 6 }], hl: [[1, 'blu', '$y=1$']], vl: [[1, 'grn', '$x=1$']] }] },
    3: { page: true, rows: ['② مثل $\\frac{x^2}{x}=x$: $\\ \\lim_{+\\infty}=+\\infty$ ، $\\lim_{-\\infty}=-\\infty$', { t: 'x\\to2:\\ \\ x^2+2\\to6,\\quad\\lim_{2^+}=+\\infty,\\quad\\lim_{2^-}=-\\infty', tex: true }], clear: true },
    4: { rows: ['③ $\\lim_{\\pm\\infty}f=2$', { t: 'x\\to-1:\\ \\ 2x-1\\to-3,\\quad\\lim_{-1^+}=-\\infty,\\quad\\lim_{-1^-}=+\\infty', tex: true }] },
  },
})
