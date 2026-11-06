solution('s12', {
  tag: 'تدرَّبْ ❶ (تتمّة)', progress: '1 / 2',
  q: '④ $f(x)=5x^3-3x-1$   ⑤ $f(x)=7x^3+2x^2-5x-1$   ⑥ $f(x)=-2x^4+100x^3$',
  beats: {
    0: { rows: ['④ مثل $5x^3$ (أُس فردي):', { t: '\\lim_{+\\infty}=+\\infty,\\qquad\\lim_{-\\infty}=-\\infty', tex: true }] },
    1: { rows: ['⑤ مثل $7x^3$:', { t: '\\lim_{+\\infty}=+\\infty,\\qquad\\lim_{-\\infty}=-\\infty', tex: true }] },
    2: { page: true, rows: ['⑥ الحدّ الأعلى درجة: $-2x^4$ (لا $100x^3$)', { t: '\\lim_{x\\to+\\infty}f(x)=\\lim_{x\\to-\\infty}f(x)=-\\infty', tex: true }] },
    3: { rows: [{ t: 'x=1000:\\ \\ 100x^3=10^{11},\\quad 2x^4=2\\times10^{12}', tex: true }], box: { t: 'الحدّ الأعلى درجة يفوز دائماً', c: 'grn' }, warn: ['لا يخدعك المعامل الكبير $100$'] },
  },
})
