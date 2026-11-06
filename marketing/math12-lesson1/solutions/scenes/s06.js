solution('s06', {
  tag: '② · ❹', progress: '5 / 21', head: '② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة:',
  q: '❹ $(u_n)_{n\\ge0}$ متتالية هندسيّة أساسها $3$ وفيها $u_1=-2$. احسب $u_n$ بدلالة $n$، واستنتج قيمة المجموعين $u_1+u_2+\\cdots+u_7$ و $u_2+u_4+u_6+\\cdots+u_{2n}$.',
  beats: {
    1: { hint: '$u_m=u_p\\,q^{m-p}$ ، $S=a\\,\\dfrac{1-q^n}{1-q}\\ \\ (q\\ne1)$', side: [{ type: 'rich', t: '$a$: أوّل حدود المجموع، $n$: عدد حدوده', cls: 's' }] },
    2: { rows: [{ t: 'u_n=u_1\\,q^{n-1}=-2\\times3^{\\,n-1}', tex: true }], box: { t: '$u_n=-2\\times3^{n-1}$', c: 'grn' },
         side: [{ type: 'tex', t: 'u_1=-2\\ \\xrightarrow{\\times3}\\ u_2=-6\\ \\xrightarrow{\\times3}\\ u_3=-18', cls: 'ms' }], clear: true },
    3: { rows: ['عدد الحدود $7$، أوّلها $a=u_1=-2$، والأساس $q=3\\ne1$:',
                { t: 'u_1+\\cdots+u_7=-2\\times\\dfrac{1-3^7}{1-3}=-2\\times\\dfrac{1-2187}{-2}=1-2187=-2186', tex: true }],
         box: { t: '$u_1+\\cdots+u_7=-2186$', c: 'grn' } },
  },
})
