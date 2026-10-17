solution('s03', {
  title: '2.7 الاستمرار والاشتقاق', paper: '📘 مبرهنة 5', paperType: 'def',
  beats: {
    0: { rows: ['① $f$ اشتقاقي في $a$ ⟸ $f$ مستمرّ في $a$', '② $f$ اشتقاقي على $I$ ⟸ $f$ مستمرّ على $I$'] },
    1: { page: true, rows: [{ t: 'g(x)=\\frac{f(x)-f(a)}{x-a},\\qquad\\lim_{x\\to a}g(x)=f\'(a)', tex: true }, { t: 'f(x)-f(a)=(x-a)\\,g(x)', tex: true }] },
    2: { rows: [{ t: '\\lim_{x\\to a}(x-a)=0\\ \\Rightarrow\\ \\lim_{x\\to a}\\big(f(x)-f(a)\\big)=0\\times f\'(a)=0', tex: true }], box: { t: '$\\lim_{x\\to a}f(x)=f(a)$ ✓', c: 'grn' } },
  },
})
