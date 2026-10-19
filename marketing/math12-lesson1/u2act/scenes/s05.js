solution('s05', {
  tag: 'نشاط 1 · ❸ تطبيق', ring: 'card',
  q: 'ليكن $f$ التابع المعرّف على $[0,+\\infty[$ وفق $f(x)=\\sqrt{x^2+1}$. بالاستفادة من ❷ ، أثبت أنّ $\\mathcal C_f$ يقبل مقارباً مائلاً في جوار $+\\infty$.',
  beats: {
    1: { rows: [{ t: '\\frac{f(x)}{x}=\\sqrt{1+\\frac1{x^2}}\\to1\\ \\Rightarrow\\ a=1', tex: true }] },
    2: { rows: [{ t: '\\sqrt{x^2+1}-x=\\frac{1}{\\sqrt{x^2+1}+x}\\to0\\ \\Rightarrow\\ b=0', tex: true }], box: { t: 'المستقيم $y=x$ مقارب مائل', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.3, xmax: 5, ymin: -0.3, ymax: 5, h: 380, fns: [{ f: 'sqrt(x*x+1)', from: 0, to: 5 }, { f: 'x', c: 'blu', dash: true }], labels: [['$y=x$', 4.3, 3.7, 'c', 'blu']] }] },
    3: { rows: ['ملاحظة: عند $-\\infty$ بطريقة مماثلة'] },
  },
})
