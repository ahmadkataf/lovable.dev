solution('s04', {
  title: '1.3 نهاية المجموع', paper: '📊 الجدول', paperType: 'def',
  beats: {
    0: { rows: [{ t: '\\begin{array}{c|c|c}\\lim f&\\lim g&\\lim(f+g)\\\\\\hline \\ell&\\ell\'&\\ell+\\ell\'\\\\ \\ell&+\\infty&+\\infty\\\\ \\ell&-\\infty&-\\infty\\\\ +\\infty&+\\infty&+\\infty\\\\ -\\infty&-\\infty&-\\infty\\\\ +\\infty&-\\infty&\\textcolor{#ff5c8a}{\\textbf{?}}\\end{array}', tex: true }] },
    1: { warn: ['$+\\infty-\\infty$: حالة عدم تعيين', 'لا نعرف من يغلب'] },
  },
})
