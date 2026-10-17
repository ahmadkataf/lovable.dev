solution('s08', {
  tag: 'تدرَّبْ ⑦ ⑧', progress: '3 / 3',
  q: '⑦ $f(x)=\\dfrac{-x^2-4x+\\sin x}{x}$ ، $\\Delta:y=-x-4$<br>⑧ $f(x)=\\dfrac{x^2+\\frac52x+\\sqrt x+1}{2x+1}$ ، $\\Delta:y=\\frac12x+1$',
  beats: {
    0: { rows: [{ t: '⑦\\ \\ f(x)=-x-4+\\frac{\\sin x}{x},\\quad f-(-x-4)=\\frac{\\sin x}{x}\\to0', tex: true }, 'مثل ③: مقارب عند $\\pm\\infty$ ، ويقطعه مرّات لا تنتهي'] },
    1: { page: true, rows: ['⑧ بسبب $\\sqrt x$: التابع معرّف عندما $x\\ge0$ ⟸ ندرس $+\\infty$ فقط'] },
    2: { rows: [{ t: '\\left(\\tfrac12x+1\\right)(2x+1)=x^2+\\tfrac52x+1', tex: true }, { t: 'f-\\left(\\tfrac12x+1\\right)=\\frac{\\sqrt x}{2x+1}\\to0,\\ \\ \\ge0', tex: true }], box: { t: '⑧ مقارب عند $+\\infty$ ، والمنحني فوقه', c: 'grn' } },
  },
})
