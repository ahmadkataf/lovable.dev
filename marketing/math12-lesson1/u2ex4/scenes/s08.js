solution('s08', {
  tag: '⓭ (⑤⑥)', progress: '3 / 3', head: U2X4_H,
  q: '⑤ $f(x)=\\dfrac{-x+\\sqrt x}{x-1}$ ، $a=1,\\,+\\infty$     ⑥ $f(x)=\\dfrac{x+1}{\\sqrt{x^2-1}}$ ، $a=-1,\\,+\\infty$',
  beats: {
    1: { rows: [{ t: 'f(x)=\\dfrac{\\sqrt x\\,(1-\\sqrt x)}{(\\sqrt x-1)(\\sqrt x+1)}=\\dfrac{-\\sqrt x}{\\sqrt x+1}', tex: true }, { t: '\\lim_{x\\to1}f(x)=-\\dfrac12\\qquad\\lim_{x\\to+\\infty}f(x)=\\lim_{x\\to+\\infty}\\dfrac{-1}{1+\\frac{1}{\\sqrt x}}=-1', tex: true }] },
    2: { page: true, rows: ['⑥ $\\mathcal D_f=]-\\infty,-1[\\,\\cup\\,]1,+\\infty[$', { t: 'f(x)=\\dfrac{(x+1)\\sqrt{x^2-1}}{(x-1)(x+1)}=\\dfrac{\\sqrt{x^2-1}}{x-1}', tex: true }, { t: '\\lim_{x\\to-1^-}f(x)=\\dfrac{0}{-2}=0', tex: true }] },
    3: { rows: [{ t: 'x>0:\\quad f(x)=\\dfrac{1+\\frac1x}{\\sqrt{1-\\frac1{x^2}}}\\ \\xrightarrow[x\\to+\\infty]{}\\ 1', tex: true }] },
  },
})
