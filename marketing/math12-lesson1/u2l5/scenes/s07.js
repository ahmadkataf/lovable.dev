solution('s07', {
  tag: 'تدرَّبْ ❶', progress: '1 / 2', ring: 'card',
  q: 'فيما يأتي، نُعطى تابعاً $f$ معرّفاً على مجموعة $D$ ويُطلب حساب نهاية $f$ عند $a$.<br>① $f(x)=\\sqrt{\\dfrac{x+3}{x-5}}$ ، $D=\\,]5,+\\infty[$ ، $a=5$<br>② $f(x)=\\sqrt{-x^3+x^2+x}$ ، $a=-\\infty$<br>③ $f(x)=\\sqrt{\\dfrac{-x+1}{x^2+1}}$ ، $a=-\\infty$<br>④ $f(x)=\\dfrac{1}{\\sqrt{1-x^2}}$ ، $D=\\,]-1,1[$ ، $a=1$',
  beats: {
    1: { rows: [{ t: '①\\ \\ \\frac{x+3}{x-5}\\to+\\infty\\ \\Rightarrow\\ \\lim_{x\\to5}f(x)=+\\infty', tex: true }] },
    2: { rows: [{ t: '②\\ \\ -x^3+x^2+x\\to+\\infty\\ \\Rightarrow\\ \\lim_{x\\to-\\infty}f(x)=+\\infty', tex: true }] },
    3: { rows: [{ t: '③\\ \\ \\frac{-x+1}{x^2+1}\\to0\\ \\Rightarrow\\ \\lim_{x\\to-\\infty}f(x)=0', tex: true }] },
    4: { rows: [{ t: '④\\ \\ 1-x^2\\to0^+\\ \\Rightarrow\\ \\lim_{x\\to1}f(x)=+\\infty', tex: true }] },
  },
})
