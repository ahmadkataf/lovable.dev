solution('s05', {
  tag: '❿ (④)', progress: '2 / 6',
  q: '④ عبّر عن $v_n$ و $w_n$ بدلالة $n$. ثُمّ استنتج عبارة $u_n$ بدلالة $n$.   ($a=2,\\ b=3$)',
  beats: {
    0: { hint: 'احسب $v_0$ و $w_0$ أوّلاً' },
    1: { rows: [{ t: 'v_0=u_1-2u_0=2\\ \\Rightarrow\\ v_n=2\\times3^n', tex: true }, { t: 'w_0=u_1-3u_0=1\\ \\Rightarrow\\ w_n=2^n', tex: true }] },
    2: { rows: [{ t: 'v_n-w_n=(u_{n+1}-2u_n)-(u_{n+1}-3u_n)=u_n', tex: true }], side: [{ type: 'chip', t: '$u_{n+1}$ يختفي ✂️', c: 'yel' }] },
    3: { page: true, rows: [{ t: 'u_0=2-1=1\\ \\checkmark\\qquad u_1=6-2=4\\ \\checkmark', tex: true }], box: { t: '$u_n=2\\times3^n-2^n$', c: 'grn' },
         side: [{ type: 'plot', pts: [[0, 1], [1, 4], [2, 14], [3, 46]], ymax: 52, c: 'grn' }], clear: true },
  },
})
