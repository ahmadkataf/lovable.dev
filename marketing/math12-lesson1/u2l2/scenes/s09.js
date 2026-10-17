var U2L2_P = { xmin: -0.4, xmax: 5.6, ymin: -0.4, ymax: 4.2, h: 380, grid: 1, xt: [2], yt: [1, 3], segs: [[0, 1, 2, 1], [2, 3, 5, 3]], pts: [[0, 1, 'c'], [2, 1, 'o'], [2, 3, 'c'], [5, 3, 'c']] }
solution('s09', {
  title: 'تكريساً للفهم: نهاية عند كلّ نقطة؟', paper: '🧠 فكّر', paperType: 'think',
  beats: {
    0: { rows: [{ t: 'f(x)=\\begin{cases}1,&x\\in[0,2[\\\\3,&x\\in[2,5]\\end{cases}', tex: true }], side: [{ type: 'graph', ...U2L2_P }] },
    1: { rows: ['$f(2)=3$ ، لكنّ $3$ ليس النهاية عند $2$', 'المجال $]2.5,3.5[$: مركزه $3$ ونصف قطره $0.5$'], side: [{ type: 'graph', ...U2L2_P, band: [2.5, 3.5, 'blu'] }], clear: true },
    2: { page: true, rows: ['أيّ مجال $J$ مركزه $2$ يحوي أعداداً أصغر من $2$', 'عندها $f(x)=1\\notin\\,]2.5,3.5[$'], box: { t: 'ليس للتابع $f$ نهاية عند $2$', c: 'red' },
         side: [{ type: 'graph', ...U2L2_P, band: [2.5, 3.5, 'blu'], vband: [1.5, 2.5, 'yel'] }], clear: true },
  },
})
