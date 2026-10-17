var U2L1_P = '0.05*x*x*x-0.4*x*x+0.8*x+1'
solution('s05', {
  title: '1.2 النهاية اللانهائيّة عند $+\\infty$', paper: '📘 تعريف 2', paperType: 'def',
  beats: {
    0: { rows: ['قيم $f(x)$ تتجاوز أيّ عدد $M$ عندما يكون $x$ كبيراً بما يكفي', { t: '\\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true, cls2: 'ml' }],
         side: [{ type: 'graph', xmin: -1, xmax: 10.5, ymin: -1, ymax: 12, h: 400, fns: [{ f: U2L1_P }] }] },
    1: { rows: ['يكافئ: أيّاً كان $M$ ، يوجد $A$ بحيث:'], box: { t: '$x>A\\ \\Rightarrow\\ f(x)>M$', c: 'yel' } },
    2: { page: true, rows: ['اختر أيّ ارتفاع $M$ ، مهما كان كبيراً', 'بعد $A$: كلّ القيم أعلى من $M$'],
         side: [{ type: 'graph', xmin: -1, xmax: 10.5, ymin: -1, ymax: 12, h: 400, fns: [{ f: U2L1_P }], hl: [[8, 'pur', '$M$', 0]], vl: [[8.15, 'yel', '$A$']], vband: [8.15, 10.5, 'yel'] }], clear: true },
    3: { page: true, rows: [{ t: '\\lim_{x\\to+\\infty}f(x)=-\\infty', tex: true }, { t: '\\lim_{x\\to-\\infty}f(x)=+\\infty', tex: true }, { t: '\\lim_{x\\to-\\infty}f(x)=-\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -1, xmax: 6, ymin: -6, ymax: 3, h: 165, fns: [{ f: '1-0.4*x*x+0.1*sin(3*x)' }], labels: [['$+\\infty\\to-\\infty$', 4.3, 2, 'c', 'mut']] },
                { type: 'graph', xmin: -6, xmax: 1, ymin: -1, ymax: 8, h: 165, fns: [{ f: '0.25*x*x+0.5' }], labels: [['$-\\infty\\to+\\infty$', -3.5, 6.5, 'c', 'mut']], dy: 178 },
                { type: 'graph', xmin: -6, xmax: 1, ymin: -6, ymax: 3, h: 165, fns: [{ f: '0.7*x+0.6*sin(x)+1' }], labels: [['$-\\infty\\to-\\infty$', -3.5, 2, 'c', 'mut']], dy: 356 }], clear: true },
  },
})
