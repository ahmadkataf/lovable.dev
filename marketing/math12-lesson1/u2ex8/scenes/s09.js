solution('s09', {
  tag: '㉗', progress: '6 / 6',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R$ وفق $f(x)=1-\\dfrac{1}{x^2+1}$. أثبت أنّ $f$ مستمرّ على $\\mathbb R$ وعيّن $f(\\mathbb R)$.',
  beats: {
    1: { rows: ['$x^2+1\\ne0$ ← $f$ مستمرّ على $\\mathbb R$'] },
    2: { page: true, rows: ['$f$ زوجي: ندرسه على $[0,+\\infty[$', { t: "f'(x)=\\dfrac{2x}{(x^2+1)^2}>0\\quad(x>0)", tex: true }, { t: 'f(0)=0,\\qquad\\lim_{x\\to+\\infty}f(x)=1', tex: true }, { t: 'f\\big([0,+\\infty[\\big)=[0,1[', tex: true }],
         side: [{ type: 'graph', xmin: -5, xmax: 5, ymin: -0.3, ymax: 1.4, h: 340, xt: [], yt: [1], fns: [{ f: '1-1/(x*x+1)' }], hl: [[1, 'blu', '$y=1$']], pts: [[0, 0, 'c', 'grn']] }] },
    3: { rows: ['بالتناظر: الصورة نفسها على $]-\\infty,0]$'], box: { t: '$f(\\mathbb R)=[0,1[$', c: 'grn' } },
  },
})
