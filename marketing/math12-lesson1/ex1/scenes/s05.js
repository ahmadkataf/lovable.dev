solution('s05', {
  tag: '❶ (⑦⑧⑨)', progress: '1 / 6', head: '❶ بيّن أيّ المتتاليات $(u_n)_{n\\ge0}$ الآتية مطّردة (ربما بدءاً من حدٍّ معيّن $n_0$).',
  q: '⑦ $u_n=1+\\dfrac12+\\cdots+\\dfrac1{2^n}$   ⑧ $u_0=8,\\ u_{n+1}=\\tfrac34u_n+2$   ⑨ $u_0=2,\\ u_{n+1}=\\tfrac34u_n+2$',
  beats: {
    0: { rows: [{ t: 'u_{n+1}=u_n+\\dfrac1{2^{n+1}}\\ \\Rightarrow\\ u_{n+1}-u_n=\\dfrac1{2^{n+1}}>0', tex: true }], box: { t: '⑦ متزايدة تماماً', c: 'grn' } },
    1: { hint: 'ماذا يحدث للعدد $8$ في العلاقة $u_{n+1}=\\tfrac34u_n+2$؟' },
    2: { page: true, rows: [{ t: '\\tfrac34\\times8+2=6+2=8', tex: true }, 'إذا كان $u_n=8$ كان $u_{n+1}=8$ ، و $u_0=8$ ← بالتدريج: $u_n=8$ لكلّ $n$'],
         box: { t: '⑧ ثابتة (والثابتة مطّردة)', c: 'grn' },
         side: [{ type: 'plot', pts: [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8]], ymin: 0, ymax: 10, c: 'blu' }] },
    3: { page: true, rows: ['⑨ نثبت بالتدريج: $u_n<8$', '$u_0=2<8$ ✓', { t: 'u_n<8\\ \\Rightarrow\\ \\tfrac34u_n+2<\\tfrac34\\times8+2=8', tex: true }],
         side: [{ type: 'plot', pts: [[0, 2], [1, 3.5], [2, 4.625], [3, 5.47], [4, 6.1], [5, 6.58]], asym: 8, ymin: 0, ymax: 9, c: 'yel' }], clear: true },
    4: { rows: [{ t: 'u_{n+1}-u_n=\\tfrac34u_n+2-u_n=\\dfrac{8-u_n}{4}>0', tex: true }], box: { t: '⑨ متزايدة تماماً', c: 'grn' } },
  },
})
