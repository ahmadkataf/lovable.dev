solution('s05', {
  tag: 'تدرَّبْ ❷ · ① ②', progress: '2 / 4', ring: 'card',
  q: 'عيّن فيما يأتي مجموعة تعريف التابع $f$ ، ثمّ ادرس في كلّ حالة نهاية $f$ عند أطراف مجموعة تعريفه، وادرس، عند اللزوم، النهاية من اليمين والنهاية من اليسار.<br>① $f(x)=\\dfrac{x+1}{\\sqrt x-1}$   ② $f(x)=x^2+\\sqrt x-1$',
  beats: {
    0: { side: [{ type: 'card', kind: 'tip', tag: 'تذكّر', t: ['ما تحت الجذر $\\ge0$', 'المقام $\\ne0$'] }] },
    1: { rows: ['① $x\\ge0$ و $\\sqrt x\\ne1$:', { t: 'D_f=[0,1[\\,\\cup\\,]1,+\\infty[', tex: true }] },
    2: { rows: [{ t: 'f(0)=-1,\\quad\\lim_{1^+}f=+\\infty,\\quad\\lim_{1^-}f=-\\infty', tex: true }, { t: 'x\\to+\\infty:\\ \\frac{x}{\\sqrt x}=\\sqrt x\\ \\Rightarrow\\ \\lim_{+\\infty}f=+\\infty', tex: true }] },
    3: { page: true, rows: ['② $D_f=[0,+\\infty[$', { t: '\\lim_{x\\to0}f(x)=-1,\\qquad\\lim_{x\\to+\\infty}f(x)=+\\infty', tex: true }] },
  },
})
