solution('s08', {
  title: 'تكريساً للفهم: الوجود والوحدانيّة', paper: '🧠 فكّر', paperType: 'think',
  beats: {
    0: { rows: ['$f$ مستمرّ على $[a,b]$ (ولو غير مطّرد):'], box: { t: '$f([a,b])=[m,M]$', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.3, xmax: 6, ymin: -0.3, ymax: 5, h: 380, xt: [[0.5, 'a'], [5.5, 'b']], yt: [[0.85, 'm'], [4.45, 'M']], fns: [{ f: '2.65+1.8*sin(1.3*x+1.6)', from: 0.5, to: 5.5 }], hl: [[0.85, 'blu', '', 1], [4.45, 'blu', '', 1]] }] },
    1: { page: true, rows: ['الاستمرار ⟸ وجود الحلّ', 'غير مستمرّ: $f(x)=4$ لها حلّ ، $f(x)=2$ لا حلّ لها'],
         side: [{ type: 'graph', xmin: -0.3, xmax: 4.6, ymin: -0.3, ymax: 5.6, h: 380, grid: 1, xt: [1, 2, 3], yt: [1, 2, 3, 4, 5], fns: [{ f: 'sqrt(x-1)', from: 1, to: 2 }, { f: '3+0.5*pow(x-2,3)/1', from: 2, to: 3.2 }, { f: '3.6+pow(x-3.2,2)*1.74', from: 3.2, to: 4 }], pts: [[2, 1, 'c'], [2, 3, 'o']], hl: [[2, 'yel', '$y=2$', 0]] }], clear: true },
    2: { page: true, rows: ['الاطّراد التامّ ⟸ وحدانيّة الحلّ', 'متزايد غير تامّ: كلّ $x\\in[2,3]$ حلّ لـ $f(x)=1$'],
         side: [{ type: 'graph', xmin: -0.3, xmax: 4.6, ymin: -0.3, ymax: 3.6, h: 380, grid: 1, xt: [1, 2, 3], yt: [1, 2, 3], fns: [{ f: 'x<2 ? sqrt(1-pow(x-2,2)) : x<3 ? 1 : 1+2*pow(x-3,3)', from: 1, to: 4 }], hl: [[1, 'yel', '$y=1$', 0]], pts: [[1, 0, 'c']] }], clear: true },
  },
})
