solution('s03', {
  tag: '❼ (1 · 2 · 3)', progress: '1 / 2',
  q: '1. عيّن عدد الأصفار عندما تأخذ $n$ القيم $1,2,3,4$ و $5$.<br>2. ما عدد الأصفار بدلالة $n$.<br>3. تحقّق أنّ $u_k=5\\times10^k+2$ في حالة $k$ من $\\{1,2,3,4,5\\}$.',
  beats: {
    0: { hint: 'عُدّ الأصفار بين $5$ و $2$' },
    1: { rows: [{ t: '\\begin{array}{c|ccccc}n&1&2&3&4&5\\\\\\hline\\text{الأصفار}&0&1&2&3&4\\end{array}', tex: true }], box: { t: 'عدد الأصفار $=n-1$', c: 'grn' } },
    2: { page: true, rows: [{ t: '10^k=1\\underbrace{00\\cdots0}_{k}', tex: true }, { t: '5\\times10^3=5\\,000', tex: true }],
         side: [{ type: 'card', kind: 'tip', tag: 'مهارة', t: ['$5\\times10^k$ = $5$ يتبعها $k$ صفراً', '$+2$ يحلّ مكان آخر صفر'] }] },
    3: { rows: [{ t: 'k=1:\\ 5\\times10+2=52=u_1\\ \\checkmark', tex: true }, { t: 'k=3:\\ 5\\,000+2=5\\,002=u_3\\ \\checkmark', tex: true }],
         box: { t: '$u_k=5\\times10^k+2$ عند $k=1,2,3,4,5$ ✓', c: 'grn' } },
  },
})
