solution('s07', {
  tag: 'تدرَّبْ ⑤ ⑥', progress: '2 / 3',
  q: '⑤ $f(x)=\\dfrac{2x^2-7x-3}{x-4}$ ، $\\Delta:y=2x+1$<br>⑥ $f(x)=\\dfrac{x^3-3x-5}{(x+1)^2}$ ، $\\Delta:y=x-2$',
  beats: {
    0: { rows: [{ t: '(2x+1)(x-4)=2x^2-7x-4', tex: true }] },
    1: { rows: [{ t: '⑤\\ \\ f-(2x+1)=\\frac{1}{x-4}\\to0', tex: true }, 'مقارب عند $\\pm\\infty$ ؛ فوق إذا $x>4$ ، تحت إذا $x<4$'] },
    2: { page: true, rows: [{ t: '(x-2)(x+1)^2=x^3-3x-2', tex: true }] },
    3: { rows: [{ t: '⑥\\ \\ f-(x-2)=\\frac{-3}{(x+1)^2}\\to0,\\ \\ <0', tex: true }, 'مقارب عند $\\pm\\infty$ ؛ المنحني تحته'] },
  },
})
