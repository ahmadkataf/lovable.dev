solution('s04', {
  tag: 'تدرَّبْ ❶ · ③ ④', progress: '1 / 2', ring: 'card',
  q: '③ $f$ تابعٌ يحقّق $|f(x)-3|\\le\\dfrac{1}{x+1}$ ، أيّاً كان $x\\ge0$. ما نهاية $f$ عند $+\\infty$؟   ④ $f$ تابعٌ يحقّق $f(x)\\ge\\dfrac14x^2$ ، أيّاً كان $x<0$. ما نهاية $f$ عند $-\\infty$؟',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to+\\infty}\\frac{1}{x+1}=0', tex: true }], box: { t: '③ $\\lim_{x\\to+\\infty}f(x)=3$ (المبرهنة 2)', c: 'grn' } },
    2: { rows: [{ t: '\\lim_{x\\to-\\infty}\\frac14x^2=+\\infty', tex: true }], box: { t: '④ $\\lim_{x\\to-\\infty}f(x)=+\\infty$ (المقارنة)', c: 'grn' } },
  },
})
