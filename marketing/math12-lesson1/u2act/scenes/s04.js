solution('s04', {
  tag: 'نشاط 1 · ❷ الحالة العامّة', ring: 'card',
  q: 'نتأمّل تابعاً $f$ يحقّق $\\lim_{x\\to+\\infty}f(x)=+\\infty$. 1. $\\Delta:\\ y=ax+b$ ($a\\ne0$) و $\\lim_{x\\to+\\infty}\\big(f(x)-(ax+b)\\big)=0$. أثبت أنّ $a=\\lim\\dfrac{f(x)}{x}$ و $b=\\lim\\big(f(x)-ax\\big)$. 2. وبالعكس، أثبت أنّه إذا كان $\\lim\\dfrac{f(x)}x=a$ ($a\\ne0$) و $\\lim\\big(f(x)-ax\\big)=b$ كان $y=ax+b$ مقارباً.',
  beats: {
    1: { rows: ['نضع $\\varepsilon(x)=f(x)-(ax+b)\\to0$', { t: '\\frac{f(x)}x=a+\\frac bx+\\frac{\\varepsilon(x)}x\\to a', tex: true }] },
    2: { rows: [{ t: 'f(x)-ax=b+\\varepsilon(x)\\to b', tex: true }] },
    3: { page: true, rows: [{ t: 'f(x)-(ax+b)=\\big(f(x)-ax\\big)-b\\to b-b=0', tex: true }], box: { t: '$a=\\lim\\dfrac{f(x)}x$ ، ثمّ $b=\\lim\\big(f(x)-ax\\big)$', c: 'grn' } },
  },
})
