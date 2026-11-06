solution('s07', {
  tag: '❶ (⑨⑩)', progress: '1 / 3', head: '❶ نهاية $f$ عند أطراف مجموعة تعريفه (من اليمين ومن اليسار عند اللّزوم)',
  q: '⑨ $f(x)=x-2\\sqrt x+3$     ⑩ $f(x)=\\sqrt{x^2+1}+x$',
  beats: {
    0: { side: [{ type: 'chip', t: '$+\\infty-\\infty$: عامل مشترك أو مرافق', c: 'yel' }] },
    1: { rows: ['⑨ $D_f=[0,+\\infty[$ ،  $\\lim_{x\\to0}f(x)=f(0)=3$', { t: 'f(x)=x\\Big(1-\\dfrac{2}{\\sqrt x}+\\dfrac3x\\Big)', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=+\\infty$', c: 'grn' } },
    2: { page: true, rows: ['⑩ $D_f=\\mathbb R$', { t: '\\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }] },
    3: { rows: [{ t: 'f(x)=\\dfrac{\\big(\\sqrt{x^2+1}+x\\big)\\big(\\sqrt{x^2+1}-x\\big)}{\\sqrt{x^2+1}-x}=\\dfrac{1}{\\sqrt{x^2+1}-x}', tex: true }], box: { t: '$\\lim_{x\\to-\\infty}f(x)=0$', c: 'grn' },
         side: [{ type: 'graph', xmin: -7, xmax: 3, ymin: -0.6, ymax: 6.5, h: 340, xt: [-5, 1], yt: [1], fns: [{ f: 'sqrt(x*x+1)+x' }] }], clear: true },
  },
})
