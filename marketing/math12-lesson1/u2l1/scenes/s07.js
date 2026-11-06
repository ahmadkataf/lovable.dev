var U2L1_S = { xmin: -0.3, xmax: 15, ymin: -1.4, ymax: 1.6, h: 330, yt: [[1, '1'], [-1, '-1']], fns: [{ f: 'sin(x)', c: 'red' }] }
solution('s07', {
  title: 'تكريساً للفهم: لماذا ليس لـ $\\sin$ نهاية؟', paper: '🧠 فكّر', paperType: 'think',
  beats: {
    0: { side: [{ type: 'graph', ...U2L1_S }] },
    1: { rows: ['نفترض جدلاً: $\\lim_{x\\to+\\infty}\\sin x=\\ell$', '$-1\\le\\sin x\\le1$ ⟸ $\\ell\\in[-1,1]$'] },
    2: { page: true, rows: ['$J$: مجال مفتوح مركزه $\\ell$ ونصف قطره $\\tfrac13$', 'طوله $\\tfrac23<2$ ⟸ لا يحتوي $1$ و $-1$ معاً', 'نفترض مثلاً: $-1\\notin J$'],
         side: [{ type: 'graph', ...U2L1_S, band: [0.55 - 1 / 3, 0.55 + 1 / 3, 'blu'], yt: [[1, '1'], [-1, '-1'], [0.55, '\\ell']], labels: [['$J$', 14.2, 0.55, 'c', 'blu']] }], clear: true },
    3: { rows: [{ t: '\\sin\\left(2k\\pi-\\tfrac{\\pi}{2}\\right)=-1\\notin J', tex: true }, 'وهذه الأعداد تكبر بلا حدود'],
         side: [{ type: 'graph', ...U2L1_S, band: [0.55 - 1 / 3, 0.55 + 1 / 3, 'blu'], yt: [[1, '1'], [-1, '-1'], [0.55, '\\ell']], pts: [[4.712, -1, 'c', 'yel'], [10.996, -1, 'c', 'yel']] }], clear: true },
    4: { rows: ['لا يوجد $A$ يجعل $\\sin x\\in J$ بعده: تناقض'], box: { t: 'ليس لتابع $\\sin$ نهاية عند $+\\infty$', c: 'red' } },
  },
})
