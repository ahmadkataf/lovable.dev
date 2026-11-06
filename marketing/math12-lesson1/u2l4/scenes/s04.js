solution('s04', {
  tag: 'مثال', ring: 'card',
  q: 'احسب نهاية التابع $f:x\\mapsto\\dfrac{\\sin x}{x}$ عند $+\\infty$.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -0.3, xmax: 22, ymin: -1.1, ymax: 1.3, h: 360, fns: [{ f: 'sin(x)/x', from: 0.3, c: 'red', n: 600 }, { f: '1/x', from: 0.8, c: 'blu', dash: true }, { f: '-1/x', from: 0.8, c: 'grn', dash: true }],
                    labels: [['$\\frac1x$', 2.5, 0.75, 'c', 'blu'], ['$-\\frac1x$', 2.5, -0.75, 'c', 'grn']] }] },
    1: { rows: [{ t: 'x>0:\\quad-1\\le\\sin x\\le1\\ \\Rightarrow\\ -\\frac1x\\le\\frac{\\sin x}{x}\\le\\frac1x', tex: true }] },
    2: { rows: [{ t: '\\lim_{x\\to+\\infty}\\left(-\\frac1x\\right)=\\lim_{x\\to+\\infty}\\frac1x=0', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}\\dfrac{\\sin x}{x}=0$ (مبرهنة الإحاطة)', c: 'grn' } },
    3: { warn: ['عند $0$: $\\ \\frac{\\sin x}{x}\\to1$', 'عند $+\\infty$: $\\ \\frac{\\sin x}{x}\\to0$'] },
  },
})
