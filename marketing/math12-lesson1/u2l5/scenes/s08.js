solution('s08', {
  tag: 'تدرَّبْ ❶ (تتمّة)', progress: '1 / 2',
  q: '⑤ $f(x)=\\cos\\pi x+\\dfrac{1}{(x-1)^2}$ ، $a=1$<br>⑥ $f(x)=\\cos\\left(\\dfrac{\\pi x+1}{x+2}\\right)$ ، $a=+\\infty$<br>⑦ $f(x)=\\sqrt{\\dfrac{2x^2}{1-x}}$ ، $D=\\,]-\\infty,1[$ ، $a=1,\\,-\\infty$',
  beats: {
    0: { rows: [{ t: '⑤\\ \\ \\cos\\pi=-1,\\ \\ \\frac1{(x-1)^2}\\to+\\infty\\ \\Rightarrow\\ \\lim_{x\\to1}f(x)=+\\infty', tex: true }] },
    1: { rows: [{ t: '⑥\\ \\ \\frac{\\pi x+1}{x+2}\\to\\pi\\ \\Rightarrow\\ \\lim_{x\\to+\\infty}f(x)=\\cos\\pi=-1', tex: true }] },
    2: { rows: [{ t: '⑦\\ \\ x\\to1^-:\\ \\frac{2x^2}{1-x}\\to+\\infty\\ \\Rightarrow\\ \\lim_{x\\to1}f(x)=+\\infty', tex: true }] },
    3: { rows: [{ t: 'x\\to-\\infty:\\ \\frac{2x^2}{1-x}\\sim-2x\\to+\\infty\\ \\Rightarrow\\ \\lim_{x\\to-\\infty}f(x)=+\\infty', tex: true }] },
  },
})
