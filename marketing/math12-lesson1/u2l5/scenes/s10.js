solution('s10', {
  tag: 'تدرَّبْ ❷', progress: '2 / 2', ring: 'card',
  q: 'ليكن $f$ التابع المعرّف على المجال $]-5,+\\infty[$ وفق $f(x)=\\dfrac{x-3}{x+5}$.<br>① احسب $\\lim_{x\\to+\\infty}f(x)$ ، واستنتج $\\lim_{x\\to+\\infty}f\\big(f(x)\\big)$.   ② أعِدْ حساب $\\lim_{x\\to+\\infty}f\\big(f(x)\\big)$ بعد كتابة $f\\big(f(x)\\big)$ بدلالة $x$.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to+\\infty}f(x)=1', tex: true }, { t: '\\lim_{x\\to+\\infty}f\\big(f(x)\\big)=f(1)=\\frac{1-3}{1+5}=-\\frac13', tex: true }] },
    2: { page: true, rows: [{ t: 'f\\big(f(x)\\big)=\\frac{\\frac{x-3}{x+5}-3}{\\frac{x-3}{x+5}+5}=\\frac{x-3-3x-15}{x-3+5x+25}=-\\frac{x+9}{3x+11}', tex: true }] },
    3: { rows: [{ t: '\\lim_{x\\to+\\infty}-\\frac{x+9}{3x+11}=-\\frac13', tex: true }], box: { t: 'النتيجة نفسها ✓ والطريقة الأولى أسرع', c: 'grn' } },
  },
})
