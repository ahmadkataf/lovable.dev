solution('s12', {
  title: 'تكريساً للفهم: التابع الكسري عند اللانهاية', paper: '🧠 قاعدة', paperType: 'think',
  beats: {
    0: { rows: ['النهاية = نهاية $\\dfrac{\\text{مسيطر البسط}}{\\text{مسيطر المقام}}$', 'نُخرج المسيطر من البسط والمقام ونختصر'] },
    1: { page: true, rows: [{ t: '\\frac{2x+6}{x^2-3x+1}=\\frac{2x\\left(1+\\frac3x\\right)}{x^2\\left(1-\\frac3x+\\frac1{x^2}\\right)}=\\frac2x\\cdot\\frac{1+\\frac3x}{1-\\frac3x+\\frac1{x^2}}', tex: true }],
         side: [{ type: 'graph', xmin: -15, xmax: 0.5, ymin: -1, ymax: 7, h: 360, fns: [{ f: '(2*x+6)/(x*x-3*x+1)', from: -15, to: 0.2 }], hl: [[0, 'blu', '$y=0$', 0]] }] },
    2: { rows: [{ t: '\\lim_{x\\to-\\infty}\\frac2x=0', tex: true }, 'وكلّ من القوسين $\\to1$'], box: { t: '$\\lim_{x\\to-\\infty}f(x)=0$ (باختصار: $\\frac{2x}{x^2}=\\frac2x\\to0$)', c: 'grn' } },
  },
})
