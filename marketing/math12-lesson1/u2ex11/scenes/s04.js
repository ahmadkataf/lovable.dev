var U2X11_T1 = '\\begin{array}{c|ccc}x&-\\infty&&-1\\\\\\hline f\'&&-&\\\\\\hline f&+\\infty&\\searrow&-\\infty\\end{array}'
var U2X11_T2 = '\\begin{array}{c|ccccc}x&-1&&0&&1\\\\\\hline f\'&&-&0&-&\\\\\\hline f&+\\infty&\\searrow&1&\\searrow&-\\infty\\end{array}'
var U2X11_T3 = '\\begin{array}{c|ccccc}x&1&&\\sqrt3&&+\\infty\\\\\\hline f\'&&-&0&+&\\\\\\hline f&+\\infty&\\searrow&1+\\frac{3\\sqrt3}{2}\\approx3.6&\\nearrow&+\\infty\\end{array}'
solution('s04', {
  tag: '㊲ (①b ②)', progress: '1 / 2', head: U2X11_H,
  q: '① b. … ثمّ أوجد $f\'(x)$ وادرس إشارته على كلٍّ من مجالات $D_f$.   ② ادرس تغيّرات $f$ ونظّم جدولاً بها.',
  beats: {
    1: { rows: [{ t: "\\Big(\\dfrac{x}{x^2-1}\\Big)'=\\dfrac{(x^2-1)-2x^2}{(x^2-1)^2}=\\dfrac{-(x^2+1)}{(x^2-1)^2}", tex: true }, { t: "x<-1:\\quad f'(x)=-1-\\dfrac{x^2+1}{(x^2-1)^2}<0", tex: true }] },
    2: { page: true, rows: [{ t: "x>-1:\\quad f'(x)=1-\\dfrac{x^2+1}{(x^2-1)^2}=\\dfrac{x^2(x^2-3)}{(x^2-1)^2}", tex: true }, '$]-1,1[$: $f\'\\le0$ (تنعدم عند $0$ فقط)', '$]1,\\sqrt3[$: $f\'<0$  ،  $]\\sqrt3,+\\infty[$: $f\'>0$'] },
    3: { page: true, rows: [{ t: U2X11_T2, tex: true }, { t: U2X11_T3, tex: true }], side: [{ type: 'tex', t: U2X11_T1, cls: 'mm' }] },
  },
})
