solution('s07', {
  tag: 'مثال', ring: 'card',
  q: 'احسب نهاية التابع $f:x\\mapsto x+\\cos x$ عند $+\\infty$.',
  beats: {
    0: { rows: ['$\\cos x$ ليس له نهاية ⟸ الجداول لا تكفي'], side: [{ type: 'graph', xmin: -0.5, xmax: 14, ymin: -2, ymax: 15, h: 380, fns: [{ f: 'x+cos(x)', c: 'red', n: 500 }, { f: 'x-1', c: 'blu', dash: true }], labels: [['$x-1$', 12, 9, 'c', 'blu']] }] },
    1: { rows: [{ t: '\\cos x\\ge-1\\ \\Rightarrow\\ f(x)=x+\\cos x\\ge x-1', tex: true }, { t: '\\lim_{x\\to+\\infty}(x-1)=+\\infty', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=+\\infty$ (المبرهنة 3)', c: 'grn' } },
  },
})
