var U2X4_H = '⓭ ادرس في كلّ حالة نهاية التابع $f$ عند $a$.'
solution('s06', {
  tag: '⓭ (①②)', progress: '3 / 3', head: U2X4_H,
  q: '① $f(x)=\\sqrt{x^2+2x}-x$ ، $a=+\\infty$     ② $f(x)=\\sqrt{4x^2+x}+2x$ ، $a=-\\infty$',
  beats: {
    1: { rows: [{ t: 'f(x)=\\dfrac{2x}{\\sqrt{x^2+2x}+x}=\\dfrac{2}{\\sqrt{1+\\frac2x}+1}', tex: true }], box: { t: '① $\\lim_{x\\to+\\infty}f(x)=1$', c: 'grn' } },
    2: { page: true, rows: [{ t: 'f(x)=\\dfrac{x}{\\sqrt{4x^2+x}-2x}=\\dfrac{-1}{\\sqrt{4+\\frac1x}+2}', tex: true }], box: { t: '② $\\lim_{x\\to-\\infty}f(x)=-\\dfrac14$', c: 'grn' },
         side: [{ type: 'chip', t: 'نقسم على $-x>0$', c: 'yel' }] },
  },
})
