var U2A_H = [
  { xmin: -3.6, xmax: 3.6, ymin: -1.6, ymax: 3.6, grid: 1, fns: [{ f: '1.5+1.5*pow(x/3,3)', from: -3, to: 3 }], labels: [['❶', -3.2, 3.1, 'c', 'pur']] },
  { xmin: -3.6, xmax: 3.6, ymin: -1.6, ymax: 3.6, grid: 1, segs: [[-3, 0, 1, 2], [1, -1, 3, 1]], pts: [[1, 2, 'c'], [1, -1, 'o']], labels: [['❷', -3.2, 3.1, 'c', 'pur']] },
  { xmin: -3.6, xmax: 3.6, ymin: -1.6, ymax: 3.6, grid: 1, fns: [{ f: '1.6/(1-x)', from: -3, to: 0.995 }, { f: '2/(x-1)', from: 1.005, to: 3 }], vl: [[1, 'grn', '', 0]], pts: [[1, 0, 'c']], labels: [['❸', -3.2, 3.1, 'c', 'pur']] },
]
solution('s06', {
  tag: 'نشاط 1', ring: 'card',
  q: '② اذكر، في كلّ حالة، عدد حلول المعادلة $f(x)=k$ ، تبعاً لقيم $k$.',
  beats: {
    0: { rows: ['حرّك مستقيماً أفقيّاً $y=k$ من الأسفل إلى الأعلى، وعُدّ نقاط التقاطع'], side: [{ type: 'graph', ...U2A_H[0], h: 420, hl: [[1, 'pur', '$y=k$', 0]] }] },
    1: { rows: [{ t: '\\begin{array}{c|c}k&\\text{عدد الحلول}\\\\\\hline 0\\le k\\le3&1\\\\ k<0\\ \\text{أو}\\ k>3&0\\end{array}', tex: true }], box: { t: '❶ يصعد باستمرار من $0$ إلى $3$', c: 'grn' },
         side: [{ type: 'graph', ...U2A_H[0], h: 420, band: [0, 3, 'grn'] }], clear: true },
    2: { page: true, rows: [{ t: '\\begin{array}{c|c}k&\\text{عدد الحلول}\\\\\\hline k\\le-1&0\\\\-1<k<0&1\\\\0\\le k\\le1&2\\\\1<k\\le2&1\\\\k>2&0\\end{array}', tex: true }],
         side: [{ type: 'graph', ...U2A_H[1], h: 420, band: [0, 1, 'yel'] }, { type: 'chip', t: '$(1,-1)$ مفرّغة: $-1$ ليست قيمة', c: 'red', dy: 440 }], clear: true },
    3: { page: true, rows: ['$m=f(-3)$: عدد صغير موجب', { t: '\\begin{array}{c|c}k&\\text{عدد الحلول}\\\\\\hline k<0&0\\\\k=0&1\\ (x=1)\\\\0<k<m&0\\\\m\\le k<1&1\\\\k\\ge1&2\\end{array}', tex: true }],
         side: [{ type: 'graph', ...U2A_H[2], h: 420, yt: [[0.4, 'm'], 1], hl: [[1.6, 'pur', '$y=k$', 0]] }], clear: true },
  },
})
