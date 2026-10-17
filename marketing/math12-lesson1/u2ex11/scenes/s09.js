solution('s09', {
  tag: '㊳ (②)', progress: '2 / 2',
  q: '② أثبت أنّ $f(x)=\\dfrac{8x}{3x-3}$ عندما تختلف $x$ عن $1$ وعن $-3$، ثمّ استنتج نهاية $f$ عند $+\\infty$.',
  beats: {
    1: { rows: ['$m(0,t)$ ،  $A$ و $M$ و $m$ على استقامة واحدة', { t: 't=4-3\\times\\dfrac{4}{x+3}=\\dfrac{4x}{x+3}', tex: true }], side: [{ type: 'graph', xmin: -4, xmax: 7, ymin: -0.8, ymax: 5, h: 380, xt: [], yt: [], segs: [[-3.6, 4.3, 6.4, -0.7, 'blu'], [-0.6, 2.95, 4.2, -0.65, 'grn']], pts: [[-3, 4, 'c', 'blu'], [2, 1, 'c', 'grn'], [5, 0, 'c', 'red'], [0, 2.5, 'c', 'yel'], [3.333, 0, 'c', 'pur']], labels: [['$A$', -3, 4.6, 'c', 'blu'], ['$B$', 2.3, 1.5, 'c', 'grn'], ['$M$', 5.2, 0.5, 'c', 'red'], ['$m$', 0.45, 2.9, 'c', 'yel'], ["$M'$", 3.4, 0.55, 'c', 'pur']] }] },
    2: { page: true, rows: [{ t: '(Bm):\\ y=t+\\dfrac{1-t}{2}\\,X\\ \\Rightarrow\\ f(x)=\\dfrac{2t}{t-1}', tex: true }, { t: 't-1=\\dfrac{3x-3}{x+3}\\ \\Rightarrow\\ f(x)=\\dfrac{8x}{3x-3}', tex: true }] },
    3: { page: true, rows: ['$x=-3$: $(AM)\\parallel(Oy)$ ← لا توجد $m$', '$x=1$: $t=1$ ← $(Bm)$ أفقي ← لا توجد $M\'$', { t: '\\lim_{x\\to+\\infty}f(x)=\\lim_{x\\to+\\infty}\\dfrac{8x}{3x}=\\dfrac83', tex: true }], box: { t: 'التخمين صحيح ✓', c: 'grn' } },
  },
})
