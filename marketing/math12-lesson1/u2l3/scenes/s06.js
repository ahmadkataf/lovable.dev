solution('s06', {
  title: '3.3 نهاية الكسر $f/g$', paper: '📊 الجدول', paperType: 'def',
  beats: {
    0: { rows: ['1.3.3 نهاية $g$ لا تساوي الصفر:', { t: '\\begin{array}{c|c|c}\\lim f&\\lim g&\\lim\\frac fg\\\\\\hline \\ell&\\ell\'\\ne0&\\frac{\\ell}{\\ell\'}\\\\ \\ell&\\pm\\infty&0\\\\ +\\infty&\\ell\'>0&+\\infty\\\\ +\\infty&\\ell\'<0&-\\infty\\\\ -\\infty&\\ell\'>0&-\\infty\\\\ -\\infty&\\ell\'<0&+\\infty\\\\ \\pm\\infty&\\pm\\infty&\\textcolor{#ff5c8a}{\\textbf{?}}\\end{array}', tex: true }] },
    1: { rows: [] },
    2: { page: true, rows: ['2.3.3 نهاية $g$ تساوي الصفر:', { t: '\\begin{array}{c|c|c}\\lim f&\\lim g&\\lim\\frac fg\\\\\\hline \\ell>0\\ \\text{أو}\\ +\\infty&0\\ (g>0)&+\\infty\\\\ \\ell>0\\ \\text{أو}\\ +\\infty&0\\ (g<0)&-\\infty\\\\ \\ell<0\\ \\text{أو}\\ -\\infty&0\\ (g>0)&-\\infty\\\\ \\ell<0\\ \\text{أو}\\ -\\infty&0\\ (g<0)&+\\infty\\\\ 0&0&\\textcolor{#ff5c8a}{\\textbf{?}}\\end{array}', tex: true }] },
    3: { rows: [] },
  },
})
