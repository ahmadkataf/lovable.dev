solution('s13', {
  tag: '③ · ❷', progress: '11 / 21',
  head: '③ $(v_n)_{n\\ge0}$ متتالية معرّفة تدريجيّاً وفق $v_0=1$ و $v_{n+1}=\\dfrac{v_n}{1+v_n}$.',
  q: '❷ أثبت أنّ المتتالية $(u_n)_{n\\ge0}$ المعرّفة بالعلاقة $u_n=\\dfrac{1}{v_n}$ متتالية حسابيّة. <span class="chip" style="font-size:26px;padding:4px 16px">$v_n\\ne0$ (من ❶)</span>',
  beats: {
    1: { hint: 'تعريف 2: $u_{n+1}=u_n+r$ أيّاً كان $n$',
         side: [{ type: 'tex', t: '\\begin{array}{c|cccc}v_n&1&\\frac12&\\frac13&\\frac14\\\\\\hline \\frac{1}{v_n}&1&\\textcolor{#6ee05a}{2}&\\textcolor{#6ee05a}{3}&\\textcolor{#6ee05a}{4}\\end{array}', cls: 'mm' }, { type: 'rich', t: '<span class="grn">$+1$ في كلّ مرّة</span> — فلنثبت ذلك لكلّ $n$', cls: 's', dy: 150 }] },
    2: { rows: ['الحدّ $u_n$ معرّف لأنّ $v_n\\ne0$. أيّاً كان العدد الطبيعي $n$:', { t: 'u_{n+1}=\\dfrac{1}{v_{n+1}}=\\dfrac{1}{\\dfrac{v_n}{1+v_n}}=\\dfrac{1+v_n}{v_n}', tex: true }] },
    3: { rows: [{ t: '=\\dfrac{1}{v_n}+\\dfrac{v_n}{v_n}=u_n+1', tex: true }, 'إذن $u_{n+1}-u_n=1$ <span class="yel b">(عدد ثابت)</span> أيّاً كان $n$'] },
    4: { box: { t: '$(u_n)_{n\\ge0}$ حسابيّة أساسها $r=1$', c: 'grn' }, rows: [{ t: 'u_0=\\dfrac{1}{v_0}=1', tex: true, cls: 'mute' }] },
    5: { warn: ['$\\dfrac{1}{v_{n+1}}=\\dfrac{1+v_n}{v_n}$ ✓', '$\\dfrac1{v_n}+\\dfrac1{1+v_n}$ ✗'] },
  },
})
