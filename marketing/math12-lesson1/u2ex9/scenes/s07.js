var U2X9_S = { type: 'graph', xmin: -0.2, xmax: 3.4, ymin: -0.2, ymax: 1.8, h: 360, xt: [[1.5708, '\\tfrac\\pi2'], [3.1416, '\\pi']], yt: [1], fns: [{ f: 'sin(x)', from: 0, to: 3.1416 }, { f: 'x/2', c: 'blu', from: 0, to: 3.3 }], pts: [[1.8955, 0.9478, 'c', 'yel']], labels: [['$\\alpha$', 1.9, 1.25, 'c', 'yel'], ['$d$', 3.1, 1.75, 'c', 'blu'], ['$\\mathcal C$', 0.7, 0.95, 'c', 'red']] }
solution('s07', {
  tag: '㉜ (①)', progress: '5 / 6',
  q: 'في معلمٍ متجانس، $\\mathcal C$ هو الخطّ البياني للتابع $f(x)=\\sin x$ على $[0,\\pi]$، و $d$ هو المستقيم $y=\\tfrac12x$.<br>① a. ارسم كلّاً من $\\mathcal C$ و $d$.  b. يبدو أنّ للمعادلة $\\sin x=\\tfrac12x$ حلّاً وحيداً $\\alpha$ في المجال $]0,\\pi]$. استفد من الرسم لإيجاد مجال صغير ينتمي إليه $\\alpha$.',
  beats: {
    1: { rows: ['تقاطع عند $0$ ، وآخر بين $1.8$ و $1.9$ تقريباً'], side: [U2X9_S] },
    2: { rows: [{ t: '\\sin1.8\\approx0.974>0.9,\\qquad \\sin1.9\\approx0.946<0.95', tex: true }], box: { t: '$\\alpha\\in\\,]1.8,1.9[$', c: 'grn' } },
  },
})
