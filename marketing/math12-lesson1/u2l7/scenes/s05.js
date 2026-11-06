solution('s05', {
  title: 'تكريساً للفهم: الاستمرار من الخطّ البياني', paper: '🧠 فكّر', paperType: 'think',
  beats: {
    0: { side: [{ type: 'graph', xmin: -2.4, xmax: 6.4, ymin: -0.4, ymax: 4.4, h: 185, grid: 1, fns: [{ f: '0.75+0.09*(x+1)*(x+1)', from: -2, to: 6 }], labels: [['❶ $\\mathcal C_f$', -1.6, 3.6, 'c', 'pur']] },
                { type: 'graph', xmin: -2.4, xmax: 6.4, ymin: -0.4, ymax: 4.4, h: 185, dy: 200, grid: 1, fns: [{ f: '2-pow((x+0.5)/3.5,2)', from: -2, to: 3 }, { f: '2+2*(x-3)/3', from: 3, to: 6 }], pts: [[3, 1, 'c'], [3, 2, 'o']], labels: [['❷ $\\mathcal C_g$', -1.6, 3.6, 'c', 'pur']] }] },
    1: { rows: ['❶ $f$ مستمرّ على $I=[-2,6]$: قطعة واحدة، دون رفع القلم'] },
    2: { rows: [{ t: '\\lim_{\\substack{x\\to3\\\\x<3}}g(x)=1,\\qquad\\lim_{\\substack{x\\to3\\\\x>3}}g(x)=2', tex: true }], box: { t: '❷ ليس للتابع $g$ نهاية عند $3$ ⟸ غير مستمرّ على $I$', c: 'red' } },
  },
})
