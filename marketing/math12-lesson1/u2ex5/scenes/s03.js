var U2X5_H = '⓮ ادرس في كلّ حالة نهاية التابع $f$.'
solution('s03', {
  tag: '⓮ (①②)', progress: '1 / 3', head: U2X5_H,
  q: '① $f(x)=\\dfrac{\\sin x}{\\sqrt x}$ ، $a=0,\\,+\\infty$     ② $f(x)=\\dfrac{1-\\cos x}{\\sin x}$ ، $a=0$',
  beats: {
    1: { rows: [{ t: 'f(x)=\\dfrac{\\sin x}{x}\\times\\sqrt x\\ \\xrightarrow[x\\to0^+]{}\\ 1\\times0=0', tex: true }] },
    2: { rows: [{ t: '|f(x)|\\le\\dfrac{1}{\\sqrt x}\\ \\xrightarrow[x\\to+\\infty]{}\\ 0', tex: true }], box: { t: '① $\\lim_{x\\to0}f(x)=0$ ، $\\lim_{x\\to+\\infty}f(x)=0$', c: 'grn' },
         side: [{ type: 'graph', xmin: 0, xmax: 30, ymin: -0.7, ymax: 1.1, h: 340, xt: [], yt: [], fns: [{ f: '1/sqrt(x)', c: 'blu', dash: true, from: 0.8 }, { f: '-1/sqrt(x)', c: 'blu', dash: true, from: 0.8 }, { f: 'sin(x)/sqrt(x)', from: 0.001, n: 900 }] }] },
    3: { page: true, rows: [{ t: 'f(x)=\\dfrac{(1-\\cos x)(1+\\cos x)}{\\sin x\\,(1+\\cos x)}=\\dfrac{\\sin^2x}{\\sin x\\,(1+\\cos x)}=\\dfrac{\\sin x}{1+\\cos x}', tex: true }], box: { t: '② $\\lim_{x\\to0}f(x)=\\dfrac02=0$', c: 'grn' } },
  },
})
