solution('s03', {
  tag: '❶ (①②③)', progress: '1 / 6', head: '❶ بيّن أيّ المتتاليات $(u_n)_{n\\ge0}$ الآتية مطّردة (ربما بدءاً من حدٍّ معيّن $n_0$).',
  q: '① $u_n=-3n+1$   ② $u_n=\\dfrac{n+1}{n+2}$   ③ $u_n=2^n$',
  beats: {
    0: { hint: 'الأدوات: إشارة الفرق، أو النسبة مع $1$، أو اطّراد التابع' },
    1: { rows: [{ t: 'u_{n+1}-u_n=\\big(-3(n+1)+1\\big)-\\big(-3n+1\\big)=-3<0', tex: true }], box: { t: '① حسابيّة أساسها $-3$ ← متناقصة تماماً', c: 'grn' },
         side: [{ type: 'plot', pts: [[0, 1], [1, -2], [2, -5], [3, -8]], xmax: 4, c: 'red' }] },
    2: { page: true, rows: [{ t: 'u_{n+1}-u_n=\\dfrac{n+2}{n+3}-\\dfrac{n+1}{n+2}=\\dfrac{(n+2)^2-(n+1)(n+3)}{(n+2)(n+3)}', tex: true }, { t: '=\\dfrac{1}{(n+2)(n+3)}>0', tex: true }],
         box: { t: '② متزايدة تماماً', c: 'grn' },
         side: [{ type: 'tex', t: '\\begin{aligned}(n+2)^2&=n^2+4n+4\\\\(n+1)(n+3)&=n^2+4n+3\\end{aligned}', cls: 'ms' }, { type: 'chip', t: 'الفرق بينهما $=1$', c: 'yel', dy: 170 }], clear: true },
    3: { page: true, rows: [{ t: 'u_n=2^n>0,\\qquad \\dfrac{u_{n+1}}{u_n}=\\dfrac{2^{n+1}}{2^n}=2>1', tex: true }], box: { t: '③ متزايدة تماماً', c: 'grn' },
         side: [{ type: 'plot', pts: [[0, 1], [1, 2], [2, 4], [3, 8], [4, 16]], c: 'grn' }], clear: true },
  },
})
