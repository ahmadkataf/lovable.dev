solution('s04', {
  tag: '㉙', progress: '2 / 6',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R$ وفق: $f(x)=\\begin{cases}\\dfrac{1-\\sqrt{x^2+1}}{x}&:\\ x\\ne0\\\\ m&:\\ x=0\\end{cases}$<br>ما قيمة $m$ التي تجعل $f$ مستمرّاً على $\\mathbb R$؟',
  beats: {
    1: { rows: ['على $\\mathbb R^*$: $f$ مستمرّ', 'المطلوب: $\\lim_{x\\to0}f(x)=m$'] },
    2: { page: true, rows: [{ t: 'f(x)=\\dfrac{1-(x^2+1)}{x\\big(1+\\sqrt{x^2+1}\\big)}=\\dfrac{-x}{1+\\sqrt{x^2+1}}\\ \\xrightarrow[x\\to0]{}\\ 0', tex: true }], box: { t: '$m=0$', c: 'grn' },
         side: [{ type: 'graph', xmin: -6, xmax: 6, ymin: -1.4, ymax: 1.4, h: 320, xt: [], yt: [1, -1], fns: [{ f: '-x/(1+sqrt(x*x+1))' }], pts: [[0, 0, 'c', 'yel']] }] },
  },
})
