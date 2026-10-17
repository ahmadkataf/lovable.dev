solution('s07', {
  tag: 'تدرَّبْ ❷ · ⑤ ⑥', progress: '2 / 4',
  q: '⑤ $f(x)=\\dfrac{x^2+x-\\sqrt x}{x^2+1}$   ⑥ $f(x)=\\sqrt{x-1}-\\sqrt x$',
  beats: {
    0: { rows: ['⑤ $x^2+1>0$ دائماً: $\\ D_f=[0,+\\infty[$ ، $\\ \\lim_{x\\to0}f(x)=0$'] },
    1: { rows: [{ t: 'f(x)=\\frac{1+\\frac1x-\\frac{1}{x\\sqrt x}}{1+\\frac1{x^2}}\\ \\Rightarrow\\ \\lim_{x\\to+\\infty}f(x)=1', tex: true }] },
    2: { page: true, rows: ['⑥ $x\\ge1$: $\\ D_f=[1,+\\infty[$ ، $\\ \\lim_{x\\to1}f(x)=0-1=-1$'] },
    3: { rows: ['عند $+\\infty$: حالة $+\\infty-\\infty$ ⟸ المرافق', { t: 'f(x)=\\frac{(x-1)-x}{\\sqrt{x-1}+\\sqrt x}=\\frac{-1}{\\sqrt{x-1}+\\sqrt x}', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=0$', c: 'grn' } },
  },
})
