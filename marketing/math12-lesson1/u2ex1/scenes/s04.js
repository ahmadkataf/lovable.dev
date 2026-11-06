solution('s04', {
  tag: '❶ (③④)', progress: '1 / 3', head: '❶ نهاية $f$ عند أطراف مجموعة تعريفه (من اليمين ومن اليسار عند اللّزوم)',
  q: '③ $f(x)=x^2+3x-\\dfrac{1}{x+3}$     ④ $f(x)=x+\\dfrac{1}{1+x}-\\dfrac{1}{x+2}$',
  beats: {
    1: { rows: ['③ $D_f=\\mathbb R\\setminus\\{-3\\}$', { t: '\\lim_{x\\to\\pm\\infty}f(x)=+\\infty', tex: true }] },
    2: { rows: [{ t: '\\lim_{x\\to-3}(x^2+3x)=9-9=0', tex: true }, { t: '\\lim_{x\\to-3^+}f(x)=-\\infty\\qquad\\lim_{x\\to-3^-}f(x)=+\\infty', tex: true }],
         side: [{ type: 'tex', t: '\\begin{array}{c|ccc}x&&-3&\\\\\\hline x+3&-&0&+\\end{array}', cls: 'mm' }] },
    3: { page: true, rows: ['④ $D_f=\\mathbb R\\setminus\\{-2,-1\\}$', { t: '\\lim_{x\\to+\\infty}f(x)=+\\infty\\qquad\\lim_{x\\to-\\infty}f(x)=-\\infty', tex: true }, { t: '\\lim_{x\\to-1^+}f(x)=+\\infty\\qquad\\lim_{x\\to-1^-}f(x)=-\\infty', tex: true }],
         side: [{ type: 'tex', t: '\\begin{array}{c|ccccc}x&&-2&&-1&\\\\\\hline x+2&-&0&+&&+\\\\ x+1&-&&-&0&+\\end{array}', cls: 'mm' }], clear: true },
    4: { rows: [{ t: '\\lim_{x\\to-2^+}f(x)=-\\infty\\qquad\\lim_{x\\to-2^-}f(x)=+\\infty', tex: true }], box: { t: 'عند كلّ قيمة ممنوعة: إشارة المقام تحدّد الجهة', c: 'yel' } },
  },
})
