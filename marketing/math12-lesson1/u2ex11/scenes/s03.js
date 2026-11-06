var U2X11_H = '㊲ تابع القيمة المطلقة: تغيّرات، حلّ معادلة'
solution('s03', {
  tag: '㊲ (①)', progress: '1 / 2', head: U2X11_H,
  q: 'ليكن $\\mathcal C$ الخطّ البياني للتابع $f$ المعرّف على $D_f=\\mathbb R\\setminus\\{-1,+1\\}$ وفق: $f(x)=|x+1|+\\dfrac{x}{x^2-1}$<br>① a. اكتب $f(x)$ بصيغة لا تحوي قيمة مطلقة.  b. ادرس نهاية $f$ عند حدود مجالات $D_f$.',
  beats: {
    1: { rows: ['$x>-1$: $f(x)=x+1+\\dfrac{x}{x^2-1}$', '$x<-1$: $f(x)=-x-1+\\dfrac{x}{x^2-1}$'] },
    2: { page: true, rows: [{ t: '\\lim_{x\\to-\\infty}f(x)=+\\infty,\\qquad\\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }] },
    3: { page: true, rows: [{ t: '\\dfrac{x}{x^2-1}=\\dfrac{x}{x-1}\\cdot\\dfrac{1}{x+1},\\qquad \\dfrac{x}{x-1}\\xrightarrow[x\\to-1]{}\\dfrac12', tex: true }, { t: '\\lim_{x\\to-1^-}f(x)=-\\infty,\\qquad\\lim_{x\\to-1^+}f(x)=+\\infty', tex: true }, { t: '\\lim_{x\\to1^-}f(x)=-\\infty,\\qquad\\lim_{x\\to1^+}f(x)=+\\infty', tex: true }] },
  },
})
