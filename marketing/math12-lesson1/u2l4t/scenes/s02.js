solution('s02', {
  tag: 'تدرَّبْ ❶ · ①', progress: '1 / 2', ring: 'card',
  q: '① $f$ تابعٌ يحقّق $\\dfrac{3x+\\cos x}{x}\\le f(x)\\le\\dfrac{3x+7}{x-1}$ ، أيّاً كان $x>1$. ما نهاية $f$ عند $+\\infty$؟',
  beats: {
    1: { rows: [{ t: '\\frac{3x+\\cos x}{x}=3+\\frac{\\cos x}{x},\\qquad-\\frac1x\\le\\frac{\\cos x}{x}\\le\\frac1x', tex: true }, { t: '\\lim_{x\\to+\\infty}\\frac{3x+\\cos x}{x}=3', tex: true }] },
    2: { rows: [{ t: '\\lim_{x\\to+\\infty}\\frac{3x+7}{x-1}=\\lim\\frac{3x}{x}=3', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=3$ (الإحاطة)', c: 'grn' } },
  },
})
