solution('s04', {
  tag: '⓮ (③④)', progress: '1 / 3', head: U2X5_H,
  q: '③ $f(x)=\\dfrac{x\\sin x}{1-\\cos x}$ ، $a=0$     ④ $f(x)=\\dfrac{2-\\sqrt{3x-2}}{\\sqrt{2x+5}-3}$ ، $a=2$',
  beats: {
    1: { rows: [{ t: 'f(x)=\\dfrac{x\\sin x\\,(1+\\cos x)}{\\sin^2x}=\\dfrac{x}{\\sin x}\\,(1+\\cos x)', tex: true }], box: { t: '③ $\\lim_{x\\to0}f(x)=1\\times2=2$', c: 'grn' } },
    2: { page: true, rows: [{ t: '\\big(2-\\sqrt{3x-2}\\big)\\big(2+\\sqrt{3x-2}\\big)=4-(3x-2)=-3(x-2)', tex: true }, { t: '\\big(\\sqrt{2x+5}-3\\big)\\big(\\sqrt{2x+5}+3\\big)=2x+5-9=2(x-2)', tex: true }],
         side: [{ type: 'chip', t: 'مرافقان: للبسط وللمقام', c: 'yel' }] },
    3: { rows: [{ t: 'f(x)=\\dfrac{-3\\big(\\sqrt{2x+5}+3\\big)}{2\\big(2+\\sqrt{3x-2}\\big)}\\ \\xrightarrow[x\\to2]{}\\ \\dfrac{-3\\times6}{2\\times4}', tex: true }], box: { t: '④ $\\lim_{x\\to2}f(x)=-\\dfrac94$', c: 'grn' } },
  },
})
