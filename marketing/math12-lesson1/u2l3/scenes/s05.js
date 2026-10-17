solution('s05', {
  title: '2.3 نهاية الجداء', paper: '📊 الجدول', paperType: 'def',
  beats: {
    0: { rows: [{ t: '\\begin{array}{c|c|c}\\lim f&\\lim g&\\lim fg\\\\\\hline \\ell&\\ell\'&\\ell\\ell\'\\\\ \\ell>0&+\\infty&+\\infty\\\\ \\ell>0&-\\infty&-\\infty\\\\ \\ell<0&+\\infty&-\\infty\\\\ \\ell<0&-\\infty&+\\infty\\\\ +\\infty&+\\infty&+\\infty\\\\ +\\infty&-\\infty&-\\infty\\\\ -\\infty&-\\infty&+\\infty\\\\ 0&\\pm\\infty&\\textcolor{#ff5c8a}{\\textbf{?}}\\end{array}', tex: true }],
         side: [{ type: 'card', kind: 'tip', tag: 'قاعدة الإشارات', t: ['$(+)\\times(+)=+$ ، $(-)\\times(-)=+$', '$(+)\\times(-)=-$'] }] },
    1: { rows: [] },
    2: { warn: ['$0\\times\\infty$: حالة عدم تعيين', 'الصفر يصغّر واللانهاية تكبّر'] },
  },
})
