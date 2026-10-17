solution('s07', {
  tag: '❽ (② · ③)', progress: '2 / 2',
  q: '② أثبت أنّ المتتالية $(v_n)_{n\\ge0}$ التي حدّها العامّ $v_n=u_n-t_n$ هي متتالية هندسيّة.<br>③ اكتب عبارة $v_n$ ثُمّ $u_n$ بدلالة $n$ و $s$.',
  beats: {
    0: { hint: 'يكفي إيجاد عدد $q$ بحيث $v_{n+1}=q\\,v_n$' },
    1: { rows: [{ t: 'v_{n+1}=u_{n+1}-t_{n+1}=\\left(\\tfrac12u_n+\\cancel{n^2+n}\\right)-\\left(\\tfrac12t_n+\\cancel{n^2+n}\\right)', tex: true }, { t: '=\\tfrac12\\,(u_n-t_n)=\\tfrac12\\,v_n', tex: true }] },
    2: { rows: ['$q=\\tfrac12$ : $(v_n)$ هندسيّة أساسها $\\tfrac12$ ، وحدّها الأوّل $v_0=u_0-t_0=s-8$'], box: { t: '🔍 الهندسيّة المخفيّة: $v_{n+1}=\\tfrac12v_n$', c: 'pur' },
         side: [{ type: 'plot', pts: [[0, 8], [1, 4], [2, 2], [3, 1], [4, .5], [5, .25]], asym: 0, ymin: 0, ymax: 9, c: 'pur' }, { type: 'chip', t: 'مثلاً $s=16$: $\\ v_n=\\dfrac{8}{2^n}$', c: 'pur', dy: 300 }] },
    3: { page: true, rows: [{ t: 'v_n=(s-8)\\left(\\tfrac12\\right)^n=\\dfrac{s-8}{2^n}', tex: true }, { t: 'u_n=v_n+t_n', tex: true }],
         box: { t: '$u_n=\\dfrac{s-8}{2^n}+2n^2-6n+8$', c: 'grn' } },
    4: { rows: [{ t: 'n=0:\\ \\ (s-8)+8=s=u_0\\ \\checkmark', tex: true }], warn: ['$v_0=s-8$ لا $s$', 'الأساس $\\tfrac12$: من معامل $u_n$ في $(*)$'] },
  },
})
