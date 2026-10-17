solution('s13', {
  tag: 'تدرَّبْ ❷', progress: '2 / 2', ring: 'card',
  q: 'احسب نهاية التابع $f$ المعطى بالعلاقة $f(x)=\\dfrac{5x-1}{x-1}$ عند $+\\infty$ ، ثُمّ أعطِ عدداً $A$ يحقّق الشرط: إذا كان $x>A$ ، كان $f(x)$ في المجال $]4.9,\\,5.1[$.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -1, xmax: 60, ymin: 4.7, ymax: 5.6, h: 380, yt: [[5, '5'], [5.1, '5.1']], xt: [[41, '41']], fns: [{ f: '(5*x-1)/(x-1)', from: 6, to: 60 }], band: [4.9, 5.1, 'blu'], vl: [[41, 'yel', '$A$']] }] },
    1: { rows: [{ t: 'f(x)-5=\\frac{5x-1-5x+5}{x-1}=\\frac{4}{x-1}', tex: true }, '$\\frac4{x-1}\\to0$ عندما $x\\to+\\infty$'], box: { t: '$\\lim_{x\\to+\\infty}f(x)=5$', c: 'grn' } },
    2: { page: true, rows: ['$]4.9,5.1[$: مركزه $5$ ونصف قطره $0.1$', { t: '\\frac{4}{|x-1|}<\\frac1{10}', tex: true }] },
    3: { rows: [{ t: 'x>1:\\quad x-1>40\\ \\Leftrightarrow\\ x>41', tex: true }], box: { t: '$A=41$ (أو أيّ عدد أكبر)', c: 'grn' } },
  },
})
