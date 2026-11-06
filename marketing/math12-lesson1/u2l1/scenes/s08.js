solution('s08', {
  tag: 'مثال: استعمال «x في غاية الكبر»', ring: 'card',
  q: 'لنتأمّل التابع $f$ المعرّف على $\\mathbb R\\setminus\\{-3/2\\}$ وفق $f(x)=\\dfrac{4x-5}{2x+3}$. من المعلوم أنّ $\\lim_{x\\to+\\infty}f(x)=2$. عيّن عدداً $A$ يحقّق الشرط: إذا كان $x>A$ انتمى $f(x)$ إلى المجال $I$ المفتوح الذي مركزه $2$ ونصف قطره $0.05$.',
  beats: {
    0: { side: [{ type: 'graph', xmin: -4, xmax: 160, ymin: 1.5, ymax: 2.12, h: 380, yt: [[2.05, '2.05'], [1.95, '1.95']], xt: [[108.5, '108.5']], fns: [{ f: '(4*x-5)/(2*x+3)', from: 9, to: 160 }], band: [1.95, 2.05, 'blu'], vl: [[108.5, 'yel', '$A$']] }] },
    2: { rows: [{ t: 'f(x)\\in I\\ \\Leftrightarrow\\ \\left|f(x)-2\\right|<\\frac1{20}', tex: true }, { t: 'f(x)-2=\\frac{4x-5}{2x+3}-2=\\frac{-11}{2x+3}', tex: true }] },
    3: { rows: [{ t: '\\frac{11}{|2x+3|}<\\frac1{20}\\ \\Leftrightarrow\\ |2x+3|>220', tex: true }] },
    4: { page: true, rows: ['نهتمّ بالقيم الكبيرة: نفترض $x>0$ ، فـ $2x+3>0$', { t: '2x+3>220\\ \\Leftrightarrow\\ x>108.5', tex: true }] },
    5: { rows: [{ t: 'x>108.5\\ \\Rightarrow\\ f(x)\\in\\,]1.95,\\,2.05[', tex: true }], box: { t: 'نختار $A$ أيّ عدد $\\ge108.5$', c: 'grn' } },
  },
})
