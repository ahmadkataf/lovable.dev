solution('s11', {
  tag: 'تدرَّبْ ❶', progress: '1 / 2',
  q: 'احسب نهايات التوابع الآتية عند $+\\infty$ وعند $-\\infty$:<br>① $f(x)=-x^3+x^2-x+1$   ② $f(x)=-3x^4+1$   ③ $f(x)=8x^4-12x^3+5x^2-x$',
  beats: {
    0: { hint: 'الحدّ الأعلى درجة هو الذي يقرّر' },
    1: { rows: ['① يتصرّف مثل $-x^3$:', { t: '\\lim_{x\\to+\\infty}f(x)=-\\infty,\\qquad\\lim_{x\\to-\\infty}f(x)=+\\infty', tex: true }] },
    2: { rows: ['② يتصرّف مثل $-3x^4$ ($x^4>0$ في الجهتين):', { t: '\\lim_{x\\to+\\infty}f(x)=\\lim_{x\\to-\\infty}f(x)=-\\infty', tex: true }] },
    3: { page: true, rows: ['③ يتصرّف مثل $8x^4$:', { t: '\\lim_{x\\to+\\infty}f(x)=\\lim_{x\\to-\\infty}f(x)=+\\infty', tex: true }] },
  },
})
