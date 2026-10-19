solution('s10', {
  title: 'النهاية من اليمين والنهاية من اليسار', paper: '📘 تعريف', paperType: 'def',
  beats: {
    0: { rows: ['قد لا يكون للتابع نهاية عند $a$ (لا حقيقيّة ولا لانهائيّة)'] },
    1: { rows: ['نقصر التعريف على $]a,+\\infty[\\,\\cap D_f$ (غير خالية)', 'إذا وُجدت نهاية $\\ell$: نهاية من اليمين', { t: '\\lim_{\\substack{x\\to a\\\\x>a}}f(x)=\\ell\\quad\\text{أو}\\quad\\lim_{x\\to a^+}f(x)=\\ell', tex: true }] },
    2: { page: true, rows: ['وعلى $]-\\infty,a[\\,\\cap D_f$: نهاية من اليسار', { t: '\\lim_{\\substack{x\\to a\\\\x<a}}f(x)=\\ell\\quad\\text{أو}\\quad\\lim_{x\\to a^-}f(x)=\\ell', tex: true }] },
  },
})
