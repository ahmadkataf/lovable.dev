solution('s03', {
  tag: '㉒ (①②)', progress: '1 / 6',
  q: 'ليكن $\\mathcal C$ الخطّ البياني للتابع $f$ المعرّف على $\\mathbb R$ وفق $f(x)=\\sqrt{4x^2-4x+3}$.<br>① ادرس نهاية $f$ عند $+\\infty$ وعند $-\\infty$.   ② a. اكتب $4x^2-4x+3$ بالشكل القانوني.  b. ادرس نهاية التابع $h(x)=f(x)-\\sqrt{(2x-1)^2}$ عند $-\\infty$ وعند $+\\infty$.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to\\pm\\infty}f(x)=+\\infty', tex: true }] },
    2: { rows: [{ t: '4x^2-4x+3=(2x-1)^2+2', tex: true }] },
    3: { page: true, rows: [{ t: '\\sqrt{(2x-1)^2}=|2x-1|', tex: true }, { t: 'h(x)=f(x)-|2x-1|=\\dfrac{2}{f(x)+|2x-1|}\\ \\xrightarrow[x\\to\\pm\\infty]{}\\ 0', tex: true }] },
  },
})
