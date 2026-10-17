solution('s05', {
  title: 'تكريساً للفهم: تغيير المتحوّل $X=\\frac1x$', paper: '🧠 فكّر', paperType: 'think',
  beats: {
    0: { rows: ['من $+\\infty$ إلى الصفر: نضع $X=\\dfrac1x$'] },
    1: { rows: [{ t: 'f(x)=x\\sin\\frac1x', tex: true }, '$x\\to+\\infty$ و $\\sin\\frac1x\\to0$: حالة $0\\times\\infty$'],
         side: [{ type: 'graph', xmin: -0.5, xmax: 15, ymin: -0.2, ymax: 1.3, h: 340, yt: [1], fns: [{ f: 'x*sin(1/x)', from: 0.25, to: 15 }], hl: [[1, 'blu', '$y=1$']] }] },
    2: { rows: [{ t: 'X=\\frac1x\\to0:\\quad f(x)=\\frac{\\sin X}{X}', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}x\\sin\\dfrac1x=\\lim_{X\\to0}\\dfrac{\\sin X}{X}=1$', c: 'grn' } },
    3: { page: true, rows: [{ t: '0^+\\leftrightarrow+\\infty,\\qquad0^-\\leftrightarrow-\\infty', tex: true, cls2: 'ml' }], box: { t: '$X=\\frac1x$ ينقل في الاتّجاهين', c: 'yel' } },
  },
})
