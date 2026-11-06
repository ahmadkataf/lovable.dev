solution('s06', {
  tag: 'تدرَّبْ ❷', progress: '2 / 2', ring: 'card',
  q: 'ليكن $f$ التابع المعرّف على المجال $[0,+\\infty[$ وفق $f(x)=\\sqrt{1+x}-\\sqrt x$.<br>① تحقّق أنّ $f(x)=\\dfrac{1}{\\sqrt{1+x}+\\sqrt x}$   ② استنتج أنّ $\\dfrac{1}{2\\sqrt{1+x}}\\le f(x)\\le\\dfrac{1}{2\\sqrt x}$ في حالة $x>0$   ③ ما نهاية $f$ عند $+\\infty$؟',
  beats: {
    1: { rows: [{ t: 'f(x)=\\frac{(\\sqrt{1+x}-\\sqrt x)(\\sqrt{1+x}+\\sqrt x)}{\\sqrt{1+x}+\\sqrt x}=\\frac{1+x-x}{\\sqrt{1+x}+\\sqrt x}=\\frac{1}{\\sqrt{1+x}+\\sqrt x}', tex: true }] },
    3: { page: true, rows: [{ t: '2\\sqrt x\\le\\sqrt{1+x}+\\sqrt x\\le2\\sqrt{1+x}', tex: true }, 'مقام أكبر ⟸ كسر أصغر', { t: '\\frac{1}{2\\sqrt{1+x}}\\le f(x)\\le\\frac{1}{2\\sqrt x}', tex: true }] },
    4: { rows: ['الطرفان $\\to0$ عند $+\\infty$'], box: { t: '③ $\\lim_{x\\to+\\infty}f(x)=0$ (الإحاطة)', c: 'grn' } },
  },
})
