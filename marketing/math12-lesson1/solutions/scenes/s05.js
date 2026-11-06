solution('s05', {
  tag: '② · ❸', progress: '4 / 21', head: '② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة:',
  q: '❸ $(u_n)_{n\\ge0}$ متتالية حسابيّة أساسها $3$ وفيها $u_1=-2$. احسب $u_n$ بدلالة $n$، واستنتج قيمة المجموعين $u_1+u_2+\\cdots+u_{20}$ و $u_{30}+u_{31}+u_{32}$.',
  beats: {
    1: { hint: '$u_m=u_p+(m-p)\\,r$ ، $S=\\dfrac{n(a+\\ell)}{2}$', side: [{ type: 'rich', t: '$n$: عدد الحدود، $a$: الأوّل، $\\ell$: الأخير', cls: 's' }] },
    2: { rows: [{ t: 'u_n=\\textcolor{#ffd23f}{u_1}+(n-1)\\,r=-2+3(n-1)=3n-5', tex: true }], box: { t: '$u_n=3n-5$', c: 'grn' },
         side: [{ type: 'chip', t: '$u_1=3\\times1-5=-2$ ✓', c: 'grn' }], clear: true },
    3: { rows: ['عدد الحدود: $20-1+1=20$ ، $a=u_1=-2$ ، $\\ell=u_{20}=3\\times20-5=55$'],
         side: [{ type: 'tex', t: '\\underbrace{u_1,\\ u_2,\\ \\dots,\\ u_{20}}_{\\text{حدّاً}\\ 20}', cls: 'mm' }], clear: true },
    4: { rows: [{ t: 'u_1+u_2+\\cdots+u_{20}=\\dfrac{20\\,(-2+55)}{2}=10\\times53=530', tex: true }], box: { t: '$u_1+u_2+\\cdots+u_{20}=530$', c: 'grn' },
         side: [{ type: 'tex', t: '\\begin{aligned}u_1+u_{20}&=-2+55=53\\\\u_2+u_{19}&=1+52=53\\\\&\\ \\ \\vdots\\end{aligned}', cls: 'ms' }, { type: 'chip', t: '$10$ أزواج $\\times\\ 53$', c: 'yel', dy: 190 }], clear: true },
    5: { rows: ['عدد الحدود: $3$ ، $a=u_{30}=3\\times30-5=85$ ، $\\ell=u_{32}=3\\times32-5=91$'], clear: true, side: [{ type: 'line', from: 28, to: 34, dots: [30, 31, 32], brace: [30, 32, '3 حدود'] }] },
    6: { rows: [{ t: 'u_{30}+u_{31}+u_{32}=\\dfrac{3\\,(85+91)}{2}=\\dfrac{3\\times176}{2}=264', tex: true }], box: { t: '$u_{30}+u_{31}+u_{32}=264$', c: 'grn' } },
    7: { rows: [{ t: 'تحقّق: $u_{31}=88$ ، $85+88+91=3\\times88=264$ ✓', cls: 'grn' }] },
    8: { warn: ['عدد الحدود $=$ الدليل الأخير $-$ الدليل الأوّل $+\\,1$', '$u_n=-2+3n$ ✗ (المعطى $u_1$ لا $u_0$)'] },
  },
})
