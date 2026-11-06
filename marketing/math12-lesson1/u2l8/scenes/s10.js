var U2L8_INV = { xmin: -0.3, xmax: 3.4, ymin: -0.3, ymax: 3.4, h: 400, grid: 1, xt: [1], yt: [1], fns: [{ f: 'x*x', from: 0, to: 1.84, c: 'red' }, { f: 'sqrt(x)', from: 0, to: 3.4, c: 'grn' }, { f: 'x', c: 'blu', dash: true }],
  labels: [['$\\mathcal C_f:\\ x^2$', 1.25, 3.0, 'c', 'red'], ['$\\mathcal C_g:\\ \\sqrt x$', 2.7, 1.4, 'c', 'grn'], ['$d:\\ y=x$', 2.8, 3.25, 'c', 'blu']] }
solution('s10', {
  title: 'تكريساً للفهم: التناظر حول $y=x$', paper: '🧠 فكّر', paperType: 'think',
  beats: {
    0: { rows: ['$f(x)=y$ ⟺ $g(y)=x$'] },
    1: { rows: ['$M(x,y)$ و $M\'(x\',y\')$ متناظرتان حول $y=x$ ⟺', { t: 'x\'=y,\\qquad y\'=x', tex: true }] },
    2: { page: true, rows: ['$M\\big(x,f(x)\\big)\\in\\mathcal C_f$ ⟺ $M\'\\big(f(x),x\\big)\\in\\mathcal C_g$'], box: { t: '$\\mathcal C_f$ و $\\mathcal C_g$ متناظران حول $d:\\ y=x$', c: 'grn' }, side: [{ type: 'graph', ...U2L8_INV }] },
    3: { rows: ['$x\\mapsto x^2$ و $x\\mapsto\\sqrt x$ على $[0,+\\infty[$: كلّ منهما عكسي للآخر'] },
  },
})
