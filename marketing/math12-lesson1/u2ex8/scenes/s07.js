solution('s07', {
  tag: '㉕', progress: '4 / 6',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R\\setminus\\{-1\\}$ وفق $f(x)=\\dfrac{x^3}{x+1}$.<br>① أثبت أنّ $f$ متزايد تماماً على $\\big[-\\tfrac32,-1\\big[$.   ② نظّم جدولاً بتغيّرات $f$ على $\\big[-\\tfrac32,-1\\big[$.   ③ أوجد $f\\big(\\big[-\\tfrac32,-1\\big[\\big)$ وأثبت أنّ للمعادلة $f(x)=10$ حلّاً وحيداً في $\\big[-\\tfrac32,-1\\big[$.',
  beats: {
    1: { rows: [{ t: "f'(x)=\\dfrac{3x^2(x+1)-x^3}{(x+1)^2}=\\dfrac{x^2(2x+3)}{(x+1)^2}", tex: true }, '$x^2>0$ و $2x+3>0$ ← $f\'(x)>0$'] },
    2: { page: true, rows: [{ t: 'f\\big(-\\tfrac32\\big)=\\dfrac{-\\frac{27}{8}}{-\\frac12}=\\dfrac{27}{4},\\qquad\\lim_{x\\to-1^-}f(x)=+\\infty', tex: true }, { t: '\\begin{array}{c|ccc}x&-\\frac32&&-1\\\\\\hline f\'(x)&&+&\\\\\\hline f(x)&\\frac{27}4&\\nearrow&+\\infty\\end{array}', tex: true }] },
    3: { page: true, rows: [{ t: 'f\\Big(\\Big[-\\tfrac32,-1\\Big[\\Big)=\\Big[\\dfrac{27}{4},+\\infty\\Big[', tex: true }, '$\\tfrac{27}{4}=6.75<10$ ← $10$ ينتمي إلى الصورة'], box: { t: 'حلّ وحيد للمعادلة $f(x)=10$', c: 'grn' },
         side: [{ type: 'graph', xmin: -2, xmax: 0.4, ymin: -1, ymax: 16, h: 380, xt: [[-1.5, '-\\tfrac32'], -1], yt: [10], fns: [{ f: 'x*x*x/(x+1)', from: -1.5, to: -1.003, n: 600 }], vl: [[-1, 'blu', '']], hl: [[10, 'yel', '$y=10$']], pts: [[-1.5, 6.75, 'c', 'red']] }] },
  },
})
