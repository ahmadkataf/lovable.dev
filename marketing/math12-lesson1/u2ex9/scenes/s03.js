solution('s03', {
  tag: '㉘', progress: '1 / 6',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R$ وفق: $f(x)=\\begin{cases}x^2\\cos\\big(\\frac1x\\big)&:\\ x\\ne0\\\\0&:\\ x=0\\end{cases}$<br>① احسب نهاية $f$ عند الصفر.   ② هل $f$ مستمرّ عند الصفر؟ هل هو مستمرّ على $\\mathbb R$؟ علّل إجابتك.',
  beats: {
    1: { rows: [{ t: '-1\\le\\cos\\tfrac1x\\le1\\ \\Rightarrow\\ |f(x)|\\le x^2', tex: true }, { t: '\\lim_{x\\to0}x^2=0\\ \\Rightarrow\\ \\lim_{x\\to0}f(x)=0', tex: true }],
         side: [{ type: 'graph', xmin: -0.5, xmax: 0.5, ymin: -0.26, ymax: 0.26, h: 360, xt: [], yt: [], fns: [{ f: 'x*x', c: 'blu', dash: true }, { f: '-x*x', c: 'blu', dash: true }, { f: 'x*x*cos(1/x)', n: 3000 }] }] },
    2: { page: true, rows: [{ t: '\\lim_{x\\to0}f(x)=0=f(0)', tex: true }, 'على $\\mathbb R^*$: جداء وتركيب توابع مستمرّة'], box: { t: '② $f$ مستمرّ على $\\mathbb R$', c: 'grn' } },
  },
})
