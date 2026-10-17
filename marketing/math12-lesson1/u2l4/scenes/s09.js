solution('s09', {
  tag: 'مثال: في جوار الصفر', ring: 'card',
  q: 'ادرس نهاية التابع $f:x\\mapsto x\\sin\\dfrac1x$ عند الصفر.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -0.45, xmax: 0.45, ymin: -0.45, ymax: 0.45, h: 380, ax: ['', ''], fns: [{ f: 'x*sin(1/x)', from: -0.45, to: 0.45, c: 'red', n: 4000, w: 3 }, { f: 'abs(x)', c: 'blu', dash: true }, { f: '-abs(x)', c: 'grn', dash: true }] }] },
    1: { rows: [{ t: '|f(x)-0|=|x|\\times\\left|\\sin\\frac1x\\right|,\\qquad\\left|\\sin\\frac1x\\right|\\le1', tex: true }, { t: '|f(x)-0|\\le|x|\\qquad(x\\in\\mathbb R\\setminus\\{0\\})', tex: true }] },
    2: { rows: [{ t: '\\lim_{x\\to0}|x|=0', tex: true }], box: { t: '$\\lim_{x\\to0}f(x)=0$ (المبرهنة 2)', c: 'grn' } },
  },
})
