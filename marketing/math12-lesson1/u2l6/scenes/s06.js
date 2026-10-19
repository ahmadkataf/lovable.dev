solution('s06', {
  tag: 'تدرَّبْ ① ② ③ ④', progress: '1 / 3',
  q: '① $f(x)=2x+3+\\dfrac{10}{x+1}$ ، $\\Delta:y=2x+3$   ② $f(x)=-x+1-\\dfrac1{x^2}$ ، $\\Delta:y=-x+1$<br>③ $f(x)=x+\\dfrac{\\sin x}{x}$ ، $\\Delta:y=x$   ④ $f(x)=3x+7-\\dfrac{5}{\\sqrt{|x|}}$ ، $\\Delta:y=3x+7$',
  beats: {
    0: { rows: [{ t: '①\\ \\ f-(2x+3)=\\frac{10}{x+1}\\to0', tex: true }, 'مقارب عند $\\pm\\infty$ ؛ فوق إذا $x>-1$ ، تحت إذا $x<-1$'] },
    1: { rows: [{ t: '②\\ \\ f-(-x+1)=-\\frac{1}{x^2}\\to0,\\ \\ <0', tex: true }, 'مقارب عند $\\pm\\infty$ ؛ المنحني تحته دائماً'] },
    2: { page: true, rows: [{ t: '③\\ \\ f-x=\\frac{\\sin x}{x}\\to0\\ \\text{(الإحاطة)}', tex: true }, 'مقارب عند $\\pm\\infty$ ؛ الإشارة تتغيّر: يقطعه مرّات لا تنتهي'],
         side: [{ type: 'graph', xmin: -0.5, xmax: 16, ymin: -0.5, ymax: 16, h: 340, fns: [{ f: 'x+sin(x)/x', from: 0.3, to: 16, n: 600 }, { f: 'x', c: 'blu', dash: true }] }] },
    3: { rows: [{ t: '④\\ \\ f-(3x+7)=-\\frac{5}{\\sqrt{|x|}}\\to0,\\ \\ <0', tex: true }, 'مقارب عند $\\pm\\infty$ ؛ المنحني تحته'], clear: true },
  },
})
