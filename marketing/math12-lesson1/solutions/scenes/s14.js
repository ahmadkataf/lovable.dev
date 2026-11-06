solution('s14', {
  tag: '③ · ❸', progress: '12 / 21',
  head: '③ $(v_n)_{n\\ge0}$ متتالية معرّفة تدريجيّاً وفق $v_0=1$ و $v_{n+1}=\\dfrac{v_n}{1+v_n}$.',
  q: '❸ استنتج عبارة $v_n$ بدلالة $n$.',
  beats: {
    1: { hint: '$u_n=u_0+n\\,r$ ، $v_n=\\dfrac{1}{u_n}$' },
    2: { rows: [{ t: 'u_n=u_0+n\\,r=1+n\\ \\Rightarrow\\ v_n=\\dfrac{1}{u_n}=\\dfrac{1}{n+1}', tex: true }], box: { t: '$v_n=\\dfrac{1}{n+1}$', c: 'grn' } },
    3: { rows: [{ t: 'تحقّق: $v_2=\\dfrac{\\frac12}{1+\\frac12}=\\dfrac13=\\dfrac{1}{2+1}$ ✓', cls: 'grn' }],
         side: [{ type: 'tex', t: '\\begin{array}{c|cccc}n&0&1&2&3\\\\\\hline \\text{بالتدريج}&1&\\frac12&\\frac13&\\frac14\\\\ \\text{بالصيغة}&1&\\frac12&\\frac13&\\frac14\\\\\\hline &\\textcolor{#6ee05a}{✓}&\\textcolor{#6ee05a}{✓}&\\textcolor{#6ee05a}{✓}&\\textcolor{#6ee05a}{✓}\\end{array}', cls: 'ms' },
                { type: 'chip', t: '⚠️ المطلوب $v_n$ لا $u_n$', c: 'org', dy: 230 }], clear: true },
  },
})
