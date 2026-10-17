solution('s04', {
  tag: '㉒ (②c ③)', progress: '1 / 6',
  q: '② c. استنتج أنّ الخطّ $\\mathcal C$ يقبل مستقيمين مقاربين مائلين يُطلب إيجاد معادلتيهما.   ③ أثبت أنّ الخطّ $\\mathcal C$ يقع فوق كلٍّ من هذين المقاربين.',
  beats: {
    1: { rows: ['$x\\to+\\infty$: $|2x-1|=2x-1$ ← $y=2x-1$', '$x\\to-\\infty$: $|2x-1|=1-2x$ ← $y=-2x+1$'],
         side: [{ type: 'graph', xmin: -3.5, xmax: 4.5, ymin: -0.5, ymax: 8, h: 400, xt: [[0.5, '\\tfrac12']], yt: [], fns: [{ f: '2*x-1', c: 'blu', dash: true, from: 0.2 }, { f: '-2*x+1', c: 'grn', dash: true, to: 0.8 }, { f: 'sqrt(4*x*x-4*x+3)' }] }] },
    2: { page: true, rows: [{ t: 'f(x)=\\sqrt{(2x-1)^2+2}\\ >\\ |2x-1|\\ \\ge\\ \\pm(2x-1)', tex: true }], box: { t: '③ $\\mathcal C$ فوق المقاربين معاً', c: 'grn' } },
  },
})
