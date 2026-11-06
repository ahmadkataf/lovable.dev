solution('s04', {
  tag: '❶ (④⑤⑥)', progress: '1 / 6', head: '❶ بيّن أيّ المتتاليات $(u_n)_{n\\ge0}$ الآتية مطّردة (ربما بدءاً من حدٍّ معيّن $n_0$).',
  q: '④ $u_n=\\left(-\\dfrac1n\\right)^n$   ⑤ $u_n=1+\\dfrac1{n^2}$   ⑥ $u_n=\\dfrac{n^2}{n!}$',
  beats: {
    0: { rows: ['④ معرّفة عند $n\\ge1$:', { t: 'u_1=-1,\\ \\ u_2=\\tfrac14,\\ \\ u_3=-\\tfrac1{27},\\ \\ u_4=\\tfrac1{256}', tex: true }],
         side: [{ type: 'plot', pts: [[1, -1], [2, .25], [3, -.037], [4, .0039]], xmin: 0, xmax: 5, ymin: -1.1, ymax: .45, c: 'red' }] },
    1: { rows: ['الإشارات: $-\\,,+\\,,-\\,,+\\,,\\dots$ ← صعود ثمّ نزول ثمّ صعود… دائماً'], box: { t: '④ غير مطّردة (ولا بدءاً من أيّ $n_0$)', c: 'red' } },
    2: { page: true, rows: [{ t: 'n\\nearrow\\ \\Rightarrow\\ n^2\\nearrow\\ \\Rightarrow\\ \\dfrac1{n^2}\\searrow', tex: true }, { t: 'u_{n+1}-u_n=\\dfrac1{(n+1)^2}-\\dfrac1{n^2}<0', tex: true }],
         box: { t: '⑤ متناقصة تماماً ($n\\ge1$)', c: 'grn' },
         side: [{ type: 'plot', pts: [[1, 2], [2, 1.25], [3, 1.111], [4, 1.0625], [5, 1.04]], asym: 1, ymin: 0, ymax: 2.3, c: 'grn' }], clear: true },
    3: { page: true, rows: [{ t: 'u_0=0,\\ u_1=1,\\ u_2=2,\\ u_3=\\tfrac32,\\ u_4=\\tfrac23', tex: true }],
         side: [{ type: 'plot', pts: [[0, 0], [1, 1], [2, 2], [3, 1.5], [4, .667], [5, .208]], ymax: 2.4, c: 'yel' }], clear: true },
    4: { rows: ['عند $n\\ge1$: الحدود موجبة تماماً', { t: '\\dfrac{u_{n+1}}{u_n}=\\dfrac{(n+1)^2}{(n+1)!}\\times\\dfrac{n!}{n^2}=\\dfrac{n+1}{n^2}', tex: true }, 'عند $n\\ge2$: $\\ n^2\\ge2n=n+n>n+1$ ← النسبة $<1$'],
         box: { t: '⑥ متناقصة تماماً بدءاً من $n_0=2$', c: 'grn' },
         side: [{ type: 'chip', t: '$(n+1)!=(n+1)\\times n!$', c: 'yel', dy: 330 }] },
  },
})
