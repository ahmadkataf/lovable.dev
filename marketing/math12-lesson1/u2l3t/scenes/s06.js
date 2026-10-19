solution('s06', {
  tag: 'تدرَّبْ ❷ · ③ ④', progress: '2 / 4',
  q: '③ $f(x)=\\sqrt x+\\dfrac1x$   ④ $f(x)=\\dfrac{x+\\sqrt x}{x+1}$',
  beats: {
    0: { rows: ['③ $x\\ge0$ و $x\\ne0$: $\\ D_f=\\,]0,+\\infty[$'] },
    1: { rows: [{ t: '\\lim_{x\\to0^+}f(x)=0+(+\\infty)=+\\infty,\\qquad\\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -0.3, xmax: 6, ymin: -0.3, ymax: 6, h: 360, fns: [{ f: 'sqrt(x)+1/x', from: 0.17, to: 6 }] }] },
    2: { page: true, rows: ['④ $D_f=[0,+\\infty[$', { t: '\\lim_{x\\to0}f(x)=0,\\qquad\\lim_{x\\to+\\infty}f(x)=1', tex: true }], box: { t: 'مثال الدرس نفسه: نُخرج $x$ من البسط والمقام', c: 'yel' } },
  },
})
