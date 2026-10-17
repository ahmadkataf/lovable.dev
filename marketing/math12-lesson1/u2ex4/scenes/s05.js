solution('s05', {
  tag: '⓬', progress: '2 / 3',
  q: 'ليكن $f$ التابع المعيّن بالعلاقة $f(x)=\\dfrac{x}{(x-1)^2}$.<br>① ادرس نهاية $f$ في جوار $1$.   ② أوجد مجالاً $I$ مركزه $1$ ويحقّق $f(x)>10^6$ ، أيّاً تكن $x$ من $I\\setminus\\{1\\}$.',
  beats: {
    1: { rows: [{ t: 'x\\to1:\\quad x\\to1,\\quad (x-1)^2\\to0^+', tex: true }, { t: '\\lim_{x\\to1}f(x)=+\\infty', tex: true }],
         side: [{ type: 'graph', xmin: -1, xmax: 3, ymin: -2, ymax: 30, h: 380, xt: [1], yt: [], fns: [{ f: 'x/((x-1)*(x-1))', n: 1000 }], vl: [[1, 'blu', '']] }] },
    2: { page: true, rows: ['$I=]1-\\alpha,1+\\alpha[$ مع $\\alpha<\\tfrac12$', { t: 'x>\\tfrac12,\\qquad (x-1)^2<\\alpha^2', tex: true }] },
    3: { rows: [{ t: 'f(x)>\\dfrac{1}{2\\alpha^2}\\ge10^6\\iff\\alpha^2\\le5\\times10^{-7}', tex: true }, { t: '\\alpha=10^{-4}:\\quad\\dfrac{1}{2\\alpha^2}=5\\times10^{7}>10^6', tex: true }] },
    4: { page: true, rows: ['وكلّ مجال أصغر بالمركز نفسه يصلح'], box: { t: '$I=]0.9999\\,,\\,1.0001[$', c: 'grn' } },
  },
})
