solution('s03', {
  tag: '❾ (③)', progress: '1 / 6',
  q: '③ نعرّف المتتالية $(u_n)_{n\\ge0}$ حيث $u_n=v_n-\\ell$. أثبت أنّ $(u_n)_{n\\ge0}$ متتالية هندسيّة، واستنتج $u_n$ بدلالة $n$ و $a$ و $b$ و $v_0$. ثمّ استنتج $v_n$ بدلالة هذه المُعاملات.',
  beats: {
    0: { hint: 'اكتب $v_{n+1}$ و $\\ell$ بالعلاقة نفسها، ثمّ اطرح' },
    1: { rows: [{ t: '\\begin{aligned}v_{n+1}&=a\\,v_n+b\\\\ \\ell&=a\\,\\ell+b\\end{aligned}', tex: true }, { t: 'u_{n+1}=v_{n+1}-\\ell=a\\,(v_n-\\ell)=a\\,u_n', tex: true }],
         side: [{ type: 'chip', t: 'بالطرح: $b$ يختفي', c: 'yel' }] },
    2: { rows: ['$(u_n)$ هندسيّة أساسها $a$ ، وحدّها الأوّل $u_0=v_0-\\ell$'], box: { t: '$u_n=\\left(v_0-\\dfrac{b}{1-a}\\right)a^n$', c: 'grn' } },
    3: { page: true, rows: [{ t: 'v_n=u_n+\\ell', tex: true }], box: { t: '$v_n=\\dfrac{b}{1-a}+\\left(v_0-\\dfrac{b}{1-a}\\right)a^n$', c: 'grn' },
         side: [{ type: 'card', kind: 'tip', tag: 'تحقّق', t: ['$n=0$: $\\ \\ell+(v_0-\\ell)=v_0$ ✓'] }], clear: true },
  },
})
