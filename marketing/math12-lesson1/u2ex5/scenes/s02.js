solution('s02', {
  title: 'تذكير: نهايات مثلّثاتيّة وتابع مركّب', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: '\\lim_{x\\to0}\\dfrac{\\sin x}{x}=1', tex: true }, { t: '1-\\cos^2x=\\sin^2x', tex: true }, 'مع $1-\\cos x$: نضرب في $1+\\cos x$'] },
    1: { page: true, rows: [{ t: '\\lim_{x\\to a}h(x)=b,\\quad\\lim_{X\\to b}g(X)=\\ell\\ \\Rightarrow\\ \\lim_{x\\to a}g\\big(h(x)\\big)=\\ell', tex: true }] },
  },
})
