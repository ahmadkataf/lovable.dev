solution('s09', {
  tag: '❺', progress: '5 / 6',
  q: 'في حالة عدد طبيعي $n\\ge1$، ليكن $u_n=1+\\dfrac12+\\dfrac13+\\cdots+\\dfrac1n$ و $v_n=u_{2n}-u_n$. أثبت أنّ المتتالية $(v_n)$ متزايدة تماماً.',
  beats: {
    0: { hint: 'اكتب $v_1$ و $v_2$ صراحةً أوّلاً' },
    1: { rows: [{ t: 'v_n=\\dfrac1{n+1}+\\dfrac1{n+2}+\\cdots+\\dfrac1{2n}', tex: true }, { t: 'v_1=u_2-u_1=\\tfrac12,\\qquad v_2=u_4-u_2=\\tfrac13+\\tfrac14', tex: true }] },
    2: { rows: [{ t: 'v_{n+1}=\\dfrac1{n+2}+\\cdots+\\dfrac1{2n}+\\dfrac1{2n+1}+\\dfrac1{2n+2}', tex: true }, { t: 'v_{n+1}-v_n=\\dfrac1{2n+1}+\\dfrac1{2n+2}-\\dfrac1{n+1}', tex: true }],
         side: [{ type: 'tex', t: '\\begin{aligned}v_n&=\\textcolor{#ff5c8a}{\\tfrac1{n+1}}+\\underbrace{\\tfrac1{n+2}+\\cdots+\\tfrac1{2n}}_{\\text{مشترك}}\\\\[4pt]v_{n+1}&=\\underbrace{\\tfrac1{n+2}+\\cdots+\\tfrac1{2n}}_{\\text{مشترك}}+\\textcolor{#6ee05a}{\\tfrac1{2n+1}+\\tfrac1{2n+2}}\\end{aligned}', cls: 'ms' }] },
    3: { page: true, rows: [{ t: '\\dfrac1{n+1}=\\dfrac2{2n+2}', tex: true }, { t: 'v_{n+1}-v_n=\\dfrac1{2n+1}-\\dfrac1{2n+2}=\\dfrac1{(2n+1)(2n+2)}>0', tex: true }],
         box: { t: '$(v_n)$ متزايدة تماماً', c: 'grn' },
         side: [{ type: 'chip', t: 'مقامٌ أصغر ← كسرٌ أكبر', c: 'yel' }], clear: true },
  },
})
