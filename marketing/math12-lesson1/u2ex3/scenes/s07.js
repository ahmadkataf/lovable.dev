solution('s07', {
  tag: '❾ (⑤⑧)', progress: '1 / 2', head: U2X3_H,
  q: '⑤ $f(x)=\\dfrac{x^4-1}{x^3-1}$ ، $a=-\\infty,\\,1,\\,+\\infty$     ⑧ $f(x)=\\dfrac{\\sqrt{x-1}}{x-1}$ ، $a=1,\\,+\\infty$',
  beats: {
    1: { rows: ['⑤ عند $\\pm\\infty$', { t: '\\lim_{x\\to\\pm\\infty}f(x)=\\lim_{x\\to\\pm\\infty}\\dfrac{x^4}{x^3}=\\lim_{x\\to\\pm\\infty}x=\\pm\\infty', tex: true }] },
    2: { page: true, rows: [{ t: 'f(x)=\\dfrac{(x-1)(x+1)(x^2+1)}{(x-1)(x^2+x+1)}', tex: true }, { t: '\\lim_{x\\to1}f(x)=\\dfrac{2\\times2}{3}=\\dfrac43', tex: true }], box: { t: 'ثقب عند $\\big(1,\\tfrac43\\big)$', c: 'yel' } },
    3: { page: true, rows: ['⑧ $D_f=]1,+\\infty[$', { t: 'f(x)=\\dfrac{\\sqrt{x-1}}{\\sqrt{x-1}\\cdot\\sqrt{x-1}}=\\dfrac{1}{\\sqrt{x-1}}', tex: true }, { t: '\\lim_{x\\to1^+}f(x)=+\\infty\\qquad\\lim_{x\\to+\\infty}f(x)=0', tex: true }] },
  },
})
