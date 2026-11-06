solution('s03', {
  tag: '⓯', progress: '1 / 5',
  q: '$(u_n)_{n\\ge0}$ متتالية معرّفة وفق $u_0=1$ و $u_{n+1}=\\sqrt{2+u_n}$ عند كلّ $n\\ge0$.<br>① أثبت أنّ $0\\le u_n\\le2$ ، أيّاً كان العدد الطبيعي $n$. \u2003 ② أثبت أنّ المتتالية $(u_n)_{n\\ge0}$ متزايدة تماماً.',
  beats: {
    0: { hint: 'بالتدريج: أضف $2$ ثمّ خذ الجذر' },
    1: { rows: ['$n=0$: $\\ 0\\le1\\le2$ ✓ \u2003 نفترض $0\\le u_n\\le2$', { t: '2\\le2+u_n\\le4', tex: true }] },
    2: { rows: [{ t: '\\sqrt2\\le\\sqrt{2+u_n}\\le\\sqrt4=2', tex: true }], box: { t: '① $0\\le u_n\\le2$ لكلّ $n$', c: 'grn' }, side: [{ type: 'chip', t: '$\\sqrt{\\ }$ متزايد', c: 'yel' }] },
    3: { page: true, hint: 'قارن $u_1$ بـ $u_0$ ، ثمّ بالتدريج' },
    4: { rows: [{ t: 'u_1=\\sqrt3\\approx1.73>1=u_0', tex: true }, 'نفترض $u_n<u_{n+1}$:', { t: '2+u_n<2+u_{n+1}\\ \\Rightarrow\\ \\sqrt{2+u_n}<\\sqrt{2+u_{n+1}}', tex: true }],
         side: [{ type: 'plot', pts: [[0, 1], [1, 1.732], [2, 1.932], [3, 1.983], [4, 1.996]], asym: 2, ymin: 0, ymax: 2.4, c: 'grn' }], clear: true },
    5: { rows: [{ t: 'u_{n+1}<u_{n+2}', tex: true }], box: { t: '② متزايدة تماماً', c: 'grn' } },
  },
})
