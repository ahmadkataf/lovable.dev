solution('s08', {
  tag: '㊱ (⑤)', progress: '3 / 3',
  q: '⑤ نعتمد معلماً جديداً $(O;\\vec u,\\vec v)$ حيث $\\vec u=\\tfrac{\\sqrt2}{2}(\\vec\\imath+\\vec\\jmath)$ و $\\vec v=\\tfrac{\\sqrt2}{2}(-\\vec\\imath+\\vec\\jmath)$. لتكن $M$ نقطة إحداثيّاتها $(x,y)$ في المعلم $(O;\\vec\\imath,\\vec\\jmath)$ و $(X,Y)$ في المعلم $(O;\\vec u,\\vec v)$. أوجد $x$ و $y$ بدلالة $X$ و $Y$، ثمّ ارسم الخطّ $\\mathcal H$ في المعلم $(O;\\vec u,\\vec v)$.',
  beats: {
    1: { rows: [{ t: '\\overrightarrow{OM}=X\\vec u+Y\\vec v=\\tfrac{\\sqrt2}{2}(X-Y)\\,\\vec\\imath+\\tfrac{\\sqrt2}{2}(X+Y)\\,\\vec\\jmath', tex: true }, { t: 'x=\\tfrac{\\sqrt2}{2}(X-Y),\\qquad y=\\tfrac{\\sqrt2}{2}(X+Y)', tex: true }],
         side: [{ ...{ type: 'graph', xmin: -4, xmax: 4, ymin: -4.5, ymax: 4.5, h: 400, xt: [], yt: [1, -1], fns: [{ f: 'x', c: 'blu', dash: true }, { f: '-x', c: 'grn', dash: true }, { f: 'sqrt(1+x*x)' }, { f: '-sqrt(1+x*x)', c: 'pur' }], labels: [['$\\mathcal C$', 2.6, 3.6, 'c', 'red'], ["$\\mathcal C'$", 2.6, -3.6, 'c', 'pur']] }, labels: [['$X$', 3.6, 3.0, 'c', 'blu'], ['$Y$', -3.6, 3.0, 'c', 'grn']] }] },
    2: { page: true, rows: [{ t: 'y^2-x^2=\\tfrac12\\big[(X+Y)^2-(X-Y)^2\\big]=\\tfrac12\\cdot4XY=2XY', tex: true }, { t: '\\mathcal H:\\ 2XY=1\\iff Y=\\dfrac{1}{2X}', tex: true }] },
    3: { rows: ['محورا المعلم الجديد: $y=x$ و $y=-x$ (دوران $45^\\circ$)'], box: { t: '$\\mathcal H$: خطّ التابع $X\\mapsto\\dfrac{1}{2X}$', c: 'grn' },
         side: [{ type: 'graph', xmin: -4, xmax: 4, ymin: -4, ymax: 4, h: 400, ax: ['X', 'Y'], xt: [], yt: [], fns: [{ f: '1/(2*x)', n: 1000 }] }], clear: true },
  },
})
