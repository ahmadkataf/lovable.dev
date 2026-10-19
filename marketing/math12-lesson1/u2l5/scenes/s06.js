solution('s06', {
  title: 'لماذا العدد المشتقّ نهاية؟', paper: '🧠 فكّر', paperType: 'think',
  beats: {
    0: { rows: ['$f$ اشتقاقي عند $a$ ⟺', { t: 't(h)=\\frac{f(a+h)-f(a)}{h}\\ \\text{له نهاية حقيقيّة}\\ \\ell\\ \\text{عند}\\ 0', tex: true }, '$\\ell=f\'(a)$'] },
    1: { rows: [{ t: 'g(x)=\\frac{f(x)-f(a)}{x-a}=t(x-a)=t\\big(h(x)\\big),\\quad h(x)=x-a', tex: true }, { t: '\\lim_{x\\to a}h(x)=0,\\qquad\\lim_{h\\to0}t(h)=f\'(a)', tex: true }] },
    2: { box: { t: '$\\lim_{x\\to a}\\dfrac{f(x)-f(a)}{x-a}=f\'(a)$', c: 'grn' } },
  },
})
