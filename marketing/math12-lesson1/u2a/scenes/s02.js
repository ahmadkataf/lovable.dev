solution('s02', {
  title: 'تذكير: المجالات والخطّ البياني', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['$[0,4]$: كلّ الأعداد من $0$ إلى $4$ مع الطرفين', '$]0,4[$: المجال المفتوح، دون الطرفين'],
         side: [{ type: 'graph', xmin: -1, xmax: 5, ymin: -1, ymax: 1, h: 160, ax: ['x', ''], xt: [0, 4], segs: [[0, 0, 4, 0, 'yel']], pts: [[0, 0, 'c', 'yel'], [4, 0, 'c', 'yel']] }] },
    1: { page: true, rows: ['النقطة $\\big(x,\\ f(x)\\big)$: الفاصلة $x$ ، والترتيب $f(x)$', 'نصعد من $x$ إلى المنحني، ثمّ نقرأ الارتفاع'],
         side: [{ type: 'graph', xmin: -1, xmax: 4, ymin: -1, ymax: 5, h: 360, fns: [{ f: '0.4*x*x+0.5' }], tracer: { x0: .5, x1: 3 }, follow: true, fa: .2, fb: .9 }], clear: true },
  },
})
