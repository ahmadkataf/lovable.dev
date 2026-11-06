solution('s07', {
  tag: '⓭ (③④)', progress: '3 / 3', head: U2X4_H,
  q: '③ $f(x)=\\dfrac{\\sqrt{x+1}-2}{x-3}$ ، $a=3$     ④ $f(x)=\\dfrac{2x}{\\sqrt{x+1}-1}$ ، $a=0$',
  beats: {
    0: { side: [{ type: 'chip', t: '$\\dfrac00$ مع جذر ← المرافق', c: 'yel' }] },
    1: { rows: [{ t: 'f(x)=\\dfrac{(x+1)-4}{(x-3)\\big(\\sqrt{x+1}+2\\big)}=\\dfrac{1}{\\sqrt{x+1}+2}', tex: true }], box: { t: '③ $\\lim_{x\\to3}f(x)=\\dfrac14$', c: 'grn' } },
    2: { page: true, rows: [{ t: 'f(x)=\\dfrac{2x\\big(\\sqrt{x+1}+1\\big)}{(x+1)-1}=2\\big(\\sqrt{x+1}+1\\big)', tex: true }], box: { t: '④ $\\lim_{x\\to0}f(x)=4$', c: 'grn' } },
  },
})
