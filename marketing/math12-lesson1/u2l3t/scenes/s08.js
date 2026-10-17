solution('s08', {
  tag: 'تدرَّبْ ❸', progress: '3 / 4', ring: 'card',
  q: 'أوجد نهاية التابع $f$ المعيّن بالعلاقة $f(x)=\\dfrac{-2x+1}{x+3}$ عند $+\\infty$ ، ثُمّ أوجد عدداً $A$ يحقّق الشرط: إذا كان $x>A$ ، كان $f(x)$ في المجال $]-2.05,\\,-1.95[$.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -5, xmax: 200, ymin: -2.3, ymax: -1.6, h: 360, ax: ['', ''], yt: [[-2.05, '-2.05'], [-1.95, '-1.95']], xt: [[137, '137']], fns: [{ f: '(-2*x+1)/(x+3)', from: 10, to: 200 }], band: [-2.05, -1.95, 'blu'], vl: [[137, 'yel', '$A$']] }] },
    1: { rows: [{ t: '\\lim_{x\\to+\\infty}f(x)=\\lim\\frac{-2x}{x}=-2', tex: true }, { t: 'f(x)+2=\\frac{-2x+1+2x+6}{x+3}=\\frac{7}{x+3}', tex: true }] },
    2: { rows: [{ t: 'x>0:\\ \\ \\frac7{x+3}<0.05\\ \\Leftrightarrow\\ x+3>140\\ \\Leftrightarrow\\ x>137', tex: true }], box: { t: '$A=137$', c: 'grn' } },
  },
})
