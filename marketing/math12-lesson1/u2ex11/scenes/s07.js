solution('s07', {
  tag: '㊲ (④)', progress: '1 / 2', head: U2X11_H,
  q: '④ أثبت أنّ للمعادلة $f(x)=0$ حلّاً وحيداً $\\alpha$ في المجال $]-1,1[$ وأوجد مجالاً طوله $10^{-1}$ تنتمي إليه $\\alpha$.',
  beats: {
    1: { rows: ['على $]-1,1[$: مستمرّ ومتناقص تماماً', { t: '\\lim_{x\\to-1^+}f(x)=+\\infty,\\qquad\\lim_{x\\to1^-}f(x)=-\\infty', tex: true }, 'الصورة $\\mathbb R$ ، و $0\\in\\mathbb R$ ← حلّ وحيد $\\alpha$'] },
    2: { rows: [{ t: 'f(0.7)\\approx0.33>0,\\qquad f(0.8)\\approx-0.42<0', tex: true }], box: { t: '$\\alpha\\in\\,]0.7,0.8[$', c: 'grn' },
         side: [{ type: 'graph', xmin: -1.1, xmax: 1.1, ymin: -4, ymax: 4, h: 380, xt: [-1, 1], yt: [1], fns: [{ f: 'x+1+x/(x*x-1)', from: -0.97, to: 0.97, n: 800 }], vl: [[-1, 'mut', ''], [1, 'mut', '']], pts: [[0.7549, 0, 'c', 'grn']], labels: [['$\\alpha$', 0.75, 0.6, 'c', 'grn']] }] },
  },
})
