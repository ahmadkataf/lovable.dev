solution('s08', {
  tag: '❼ (③)', progress: '4 / 5',
  q: '③ أعد الدراسة السابقة في جوار $-\\infty$.',
  beats: {
    0: { side: [{ type: 'chip', t: '$x<0$: $\\sqrt{x^2}=|x|=-x$', c: 'red' }] },
    1: { rows: [{ t: 'x\\to-\\infty:\\quad f(x)\\approx\\sqrt2\\,|x|=-\\sqrt2\\,x', tex: true }, { t: 'f(x)+\\sqrt2\\,x=\\dfrac{x+1}{\\sqrt{2x^2+x+1}-\\sqrt2\\,x}', tex: true }] },
    2: { rows: [{ t: '=\\dfrac{-1-\\frac1x}{\\sqrt{2+\\frac1x+\\frac1{x^2}}+\\sqrt2}\\ \\xrightarrow[x\\to-\\infty]{}\\ -\\dfrac{1}{2\\sqrt2}=-\\dfrac{\\sqrt2}{4}', tex: true }],
         side: [{ type: 'chip', t: 'نقسم على $-x>0$', c: 'yel' }], clear: true },
    3: { page: true, rows: [], box: { t: '③ مقارب مائل عند $-\\infty$: $y=-\\sqrt2\\,x-\\frac{\\sqrt2}{4}$', c: 'grn' },
         side: [{ type: 'graph', xmin: -5, xmax: 5, ymin: -0.5, ymax: 8, h: 380, xt: [], yt: [], fns: [{ f: 'SQRT2*x+SQRT2/4', c: 'blu', dash: true, from: -0.6 }, { f: '-SQRT2*x-SQRT2/4', c: 'grn', dash: true, to: 0.1 }, { f: 'sqrt(2*x*x+x+1)' }] }], clear: true },
  },
})
