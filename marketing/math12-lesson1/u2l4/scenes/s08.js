solution('s08', {
  tag: 'مثال: مع تابع الجزء الصحيح', ring: 'card',
  q: 'ادرس نهاية التابع $f:x\\mapsto\\dfrac{E(x)}{x}$ عند $+\\infty$. ($E$ هو تابع الجزء الصحيح)',
  beats: {
    0: { side: [{ type: 'graph', xmin: -0.3, xmax: 14, ymin: -0.2, ymax: 1.3, h: 360, yt: [1], fns: [{ f: 'floor(x)/x', from: 1, to: 14, c: 'red', brk: 0.02, n: 1400 }, { f: '(x-1)/x', from: 1, to: 14, c: 'grn', dash: true }], hl: [[1, 'blu', '$y=1$']] }] },
    1: { rows: [{ t: 'E(x)\\le x<E(x)+1\\ \\Leftrightarrow\\ x-1<E(x)\\le x', tex: true }] },
    2: { rows: [{ t: 'x>0:\\quad\\frac{x-1}{x}\\le\\frac{E(x)}{x}\\le1', tex: true }] },
    3: { rows: [{ t: '\\lim_{x\\to+\\infty}\\frac{x-1}{x}=\\lim_{x\\to+\\infty}\\left(1-\\frac1x\\right)=1', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}\\dfrac{E(x)}{x}=1$ (الإحاطة)', c: 'grn' } },
  },
})
