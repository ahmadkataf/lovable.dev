solution('s07', {
  tag: '㉑ (①②)', progress: '4 / 4',
  q: 'ليكن $\\mathcal C$ الخطّ البياني للتابع $f$ المعرّف على $\\mathbb R$ وفق $f(x)=x+\\sqrt{|4x^2-1|}$.<br>① ادرس نهاية $f$ عند $-\\infty$ وعند $+\\infty$.   ② a. احسب $\\lim_{x\\to+\\infty}\\big(f(x)-3x\\big)$.  b. احسب $\\lim_{x\\to-\\infty}\\big(f(x)+x\\big)$.',
  beats: {
    1: { rows: ['عند $\\pm\\infty$: $4x^2-1>0$', { t: '\\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }, { t: 'x<0:\\quad f(x)=x\\Big(1-\\sqrt{4-\\tfrac1{x^2}}\\Big)', tex: true }, 'القوس $\\to-1$ ← $\\lim_{x\\to-\\infty}f(x)=+\\infty$'] },
    2: { page: true, rows: [{ t: 'f(x)-3x=\\sqrt{4x^2-1}-2x=\\dfrac{-1}{\\sqrt{4x^2-1}+2x}\\ \\xrightarrow[x\\to+\\infty]{}\\ 0', tex: true }] },
    3: { rows: [{ t: 'f(x)+x=2x+\\sqrt{4x^2-1}=\\dfrac{-1}{\\sqrt{4x^2-1}-2x}\\ \\xrightarrow[x\\to-\\infty]{}\\ 0', tex: true }] },
  },
})
