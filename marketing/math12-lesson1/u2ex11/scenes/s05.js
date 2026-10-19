solution('s05', {
  tag: '㊲ (③a)', progress: '1 / 2', head: U2X11_H,
  q: '③ a. تحقّق من أنّ المستقيمين اللذين معادلتاهما $y=x+1$ و $y=-x-1$ هما، بالترتيب، مقاربان مائلان للخطّ البياني $\\mathcal C$ عند $+\\infty$ وعند $-\\infty$. ادرس وضع $\\mathcal C$ بالنسبة إلى هذين المقاربين.',
  beats: {
    1: { rows: [{ t: 'f(x)-(x+1)=\\dfrac{x}{x^2-1}\\ \\xrightarrow[x\\to+\\infty]{}\\ 0', tex: true }, { t: 'f(x)-(-x-1)=\\dfrac{x}{x^2-1}\\ \\xrightarrow[x\\to-\\infty]{}\\ 0', tex: true }] },
    2: { page: true, rows: [{ t: '\\begin{array}{c|ccccccc}x&&-1&&0&&1&\\\\\\hline \\dfrac{x}{x^2-1}&-&||&+&0&-&||&+\\end{array}', tex: true }, 'بعد $-1$: فوق $y=x+1$ على $]-1,0[$ وعلى $]1,+\\infty[$ ،  تحته على $]0,1[$'],
         side: [{ type: 'graph', xmin: -5, xmax: 5, ymin: -7, ymax: 9, h: 400, xt: [-1, 1], yt: [1], fns: [{ f: 'x+1', c: 'blu', dash: true, from: -1 }, { f: '-x-1', c: 'grn', dash: true, to: -1 }, { f: 'abs(x+1)+x/(x*x-1)', n: 1600 }], vl: [[-1, 'mut', ''], [1, 'mut', '']] }] },
    3: { rows: ['قبل $-1$: الكسر سالب ← $\\mathcal C$ تحت $y=-x-1$'] },
  },
})
