var U2X11_F = { type: 'graph', xmin: -8, xmax: 8, ymin: -10, ymax: 14, h: 380, xt: [1], yt: [], fns: [{ f: '8*x/(3*x-3)', n: 1200 }], hl: [[8 / 3, 'grn', '$y=\\frac83$']], vl: [[1, 'blu', '']] }
solution('s10', {
  tag: '㊳ (③)', progress: '2 / 2',
  q: '③ a. ادرس نهاية $f$ عند $-\\infty$. ما التأويل الهندسي لهذه النتيجة؟  b. ادرس نهاية $f$ عند $x=1$. ما التأويل الهندسي لهذه النتيجة؟',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to-\\infty}f(x)=\\dfrac83', tex: true }, '$M\\to-\\infty$ ← $M\'\\to\\big(\\tfrac83,0\\big)$ ،  $y=\\tfrac83$ مقارب أفقي'], side: [U2X11_F] },
    2: { rows: [{ t: '\\lim_{x\\to1^+}f(x)=+\\infty,\\qquad\\lim_{x\\to1^-}f(x)=-\\infty', tex: true }, '$M\\to(1,0)$ ← $m\\to(0,1)$ ← $(Bm)$ شبه أفقي ← $M\'$ إلى اللانهاية'] },
  },
})
