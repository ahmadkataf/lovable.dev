solution('s04', {
  tag: '⓲ (②)', progress: '1 / 4',
  q: '② a. احسب $\\lim_{x\\to-\\infty}f(x)$.  b. أثبت وجود عدد حقيقي $a$ يحقّق $\\lim_{x\\to-\\infty}\\dfrac{f(x)}{x}=a$ وأنّ نهاية $x\\mapsto f(x)-ax$ عند $-\\infty$ عددٌ حقيقي $b$.  c. استنتج وجود مقارب مائل $\\Delta\'$ للخطّ $\\mathcal C$ في جوار $-\\infty$.',
  beats: {
    1: { rows: [{ t: '\\lim_{x\\to-\\infty}f(x)=+\\infty', tex: true }, { t: 'x<0:\\quad \\dfrac{f(x)}{x}=\\dfrac{|x|\\sqrt{1+\\frac2x+\\frac4{x^2}}}{x}=-\\sqrt{1+\\tfrac2x+\\tfrac4{x^2}}\\to-1', tex: true }], box: { t: '$a=-1$', c: 'grn' } },
    2: { rows: [{ t: 'f(x)+x=\\dfrac{2x+4}{f(x)-x}=\\dfrac{-2-\\frac4x}{\\sqrt{1+\\frac2x+\\frac4{x^2}}+1}\\to-1', tex: true }], box: { t: '$b=-1$', c: 'grn' } },
    3: { page: true, rows: [], box: { t: "c. $\\Delta':\\ y=-x-1$ مقارب مائل في جوار $-\\infty$", c: 'grn' }, side: [U2X7_18] },
  },
})
