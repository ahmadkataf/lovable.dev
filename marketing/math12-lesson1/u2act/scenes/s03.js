solution('s03', {
  tag: 'نشاط 1 · ❶ أمثلة', ring: 'card',
  q: '2. $f$ هو التابع المعرّف على $[0,+\\infty[$ وفق $f(x)=\\dfrac{2x^2+1}{x+3}$. ① عيّن عددين $b$ و $c$ يحقّقان $f(x)=2x+b+\\dfrac{c}{x+3}$ أيّاً كان $x\\ge0$. ② استنتج أنّ $\\mathcal C_f$ يقبل مقارباً مائلاً $\\Delta$ ، وبيّنْ وضعه بالنسبة إلى $\\mathcal C_f$.',
  beats: {
    0: { rows: ['$x$ كبير: $\\ \\frac{2x^2}{x}=2x$ ⟸ مقارب من النمط $y=2x+b$؟'] },
    2: { rows: [{ t: '2x(x+3)+b(x+3)+c=2x^2+(6+b)x+(3b+c)', tex: true }] },
    3: { rows: [{ t: '6+b=0,\\quad3b+c=1\\ \\Rightarrow\\ b=-6,\\ c=19', tex: true }], box: { t: '$f(x)=2x-6+\\dfrac{19}{x+3}$', c: 'grn' } },
    4: { page: true, rows: [{ t: '\\frac{19}{x+3}\\to0,\\qquad\\frac{19}{x+3}>0', tex: true }], box: { t: '$\\Delta:\\ y=2x-6$ مقارب ، و $\\mathcal C_f$ فوقه', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.5, xmax: 12, ymin: -2, ymax: 20, h: 380, fns: [{ f: '(2*x*x+1)/(x+3)', from: 0, to: 12 }, { f: '2*x-6', c: 'blu', dash: true }], labels: [['$\\Delta$', 11, 13, 'c', 'blu']] }] },
  },
})
