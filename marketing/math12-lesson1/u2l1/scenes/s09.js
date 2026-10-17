solution('s09', {
  tag: 'مثال: الوضع النسبي للخطّ البياني ومقاربه الأفقي', ring: 'card',
  q: 'في المثال السابق، لمّا كان $\\lim_{x\\to+\\infty}f(x)=2$ ، كان المستقيم $\\Delta:\\ y=2$ مقارباً أفقيّاً للخطّ البياني $\\mathcal C_f$. ادرس، بالاعتماد على إشارة $f(x)-2$ ، وضع $\\mathcal C_f$ بالنسبة إلى $\\Delta$.',
  beats: {
    1: { rows: ['الفرق $>0$ ⟸ المنحني فوق ، الفرق $<0$ ⟸ المنحني تحت', { t: 'f(x)-2=\\frac{-11}{2x+3}', tex: true }] },
    2: { page: true, rows: [{ t: '\\begin{array}{c|ccc}x&-\\infty&\\quad-\\tfrac32\\quad&+\\infty\\\\\\hline 2x+3&\\quad-&\\Vert&+\\\\ f(x)-2&\\quad+&\\Vert&-\\end{array}', tex: true }],
         box: { t: '$\\mathcal C_f$ فوق $\\Delta$ على $]-\\infty,-\\tfrac32[$ ، وتحته على $]-\\tfrac32,+\\infty[$', c: 'grn' },
         side: [{ type: 'graph', xmin: -9, xmax: 9, ymin: -4, ymax: 8, h: 400, yt: [2], fns: [{ f: '(4*x-5)/(2*x+3)', from: -9, to: -1.62 }, { f: '(4*x-5)/(2*x+3)', from: -1.38, to: 9 }], hl: [[2, 'blu', '$\\Delta$']], vband: [-9, -1.5, 'grn'] }] },
  },
})
