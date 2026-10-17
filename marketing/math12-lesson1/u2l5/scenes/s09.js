solution('s09', {
  tag: 'تدرَّبْ ❶ (تتمّة)', progress: '1 / 2',
  q: '⑧ $f(x)=\\sin\\left(\\dfrac1{\\sqrt x}\\right)$ ، $a=+\\infty$<br>⑨ $f(x)=\\left(x-\\sqrt x+\\dfrac1x\\right)^2$ ، $a=+\\infty$<br>⑩ $f(x)=\\cos^2\\left(\\pi\\times\\sqrt{\\dfrac{x-1}{x+1}}\\right)$ ، $a=+\\infty$',
  beats: {
    0: { rows: [{ t: '⑧\\ \\ \\frac1{\\sqrt x}\\to0\\ \\Rightarrow\\ \\lim_{x\\to+\\infty}f(x)=\\sin0=0', tex: true }] },
    1: { rows: [{ t: '⑨\\ \\ x-\\sqrt x=\\sqrt x(\\sqrt x-1)\\to+\\infty\\ \\Rightarrow\\ \\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }] },
    2: { rows: [{ t: '⑩\\ \\ \\sqrt{\\frac{x-1}{x+1}}\\to1\\ \\Rightarrow\\ \\lim_{x\\to+\\infty}f(x)=\\cos^2\\pi=1', tex: true }] },
  },
})
