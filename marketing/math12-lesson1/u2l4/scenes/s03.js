var U2L4_SQ = { xmin: -0.5, xmax: 14, ymin: -1.5, ymax: 5.5, h: 400, yt: [[2, '\\ell']], fns: [{ f: '2+3/(x+0.6)', c: 'blu' }, { f: '2-3/(x+0.6)', c: 'grn' }, { f: '2+2.7*sin(3*x)/(x+0.6)', c: 'red', n: 900 }],
  labels: [['$\\mathcal C_h$', 1.6, 4.2, 'c', 'blu'], ['$\\mathcal C_g$', 1.6, -0.3, 'c', 'grn'], ['$\\mathcal C_f$', 0.6, 3.3, 'c', 'red']] }
solution('s03', {
  title: '1.4 مبرهنة الإحاطة', paper: '📘 مبرهنة 1', paperType: 'def',
  beats: {
    0: { rows: ['$f$ ، $g$ ، $h$ معرّفة على $I=\\,]b,+\\infty[$', { t: 'g(x)\\le f(x)\\le h(x)', tex: true, cls2: 'ml' }], side: [{ type: 'graph', ...U2L4_SQ }] },
    1: { rows: [{ t: '\\lim_{x\\to+\\infty}g(x)=\\lim_{x\\to+\\infty}h(x)=\\ell', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=\\ell$', c: 'grn' } },
    2: { page: true, rows: ['الإثبات: كلّ مجال مفتوح مركزه $\\ell$ يحوي قيم $g(x)$ و $h(x)$ عندما $x>A$ ($A>b$)'],
         side: [{ type: 'graph', ...U2L4_SQ, band: [1.55, 2.45, 'blu'], vl: [[6.5, 'yel', '$A$']] }], clear: true },
    3: { rows: ['$f(x)$ محصور بينهما ⟸ قيمه في المجال نفسه عندما $x>A$'], box: { t: '$\\lim_{x\\to+\\infty}f(x)=\\ell$ (التعريف 1)', c: 'grn' } },
  },
})
