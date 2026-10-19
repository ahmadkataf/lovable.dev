solution('s05', {
  tag: '⓰ (①)', progress: '2 / 5',
  q: '$(u_n)_{n\\ge0}$ متتالية معرّفة وفق $u_0=1$ و $u_{n+1}=\\dfrac{3u_n+2}{2u_n+6}$ عند كلّ $n\\ge0$.<br>① أثبت أنّ التابع $x\\mapsto\\dfrac{3x+2}{2x+6}$ متزايدٌ تماماً واستنتج أنّ $\\tfrac12<u_n\\le1$ ، أيّاً كان العدد $n$.',
  beats: {
    0: { hint: 'المشتقّ، ثمّ البرهان بالتدريج' },
    1: { rows: [{ t: 'f\'(x)=\\dfrac{3(2x+6)-2(3x+2)}{(2x+6)^2}=\\dfrac{14}{(2x+6)^2}>0', tex: true }, '$f$ متزايد تماماً على $]-3,+\\infty[$'] },
    2: { page: true, rows: ['$n=0$: $\\ \\tfrac12<1\\le1$ ✓', 'نفترض $\\tfrac12<u_n\\le1$ ، ونطبّق $f$ المتزايد:', { t: 'f\\!\\left(\\tfrac12\\right)<f(u_n)\\le f(1)', tex: true }] },
    3: { rows: [{ t: 'f\\!\\left(\\tfrac12\\right)=\\dfrac{\\frac32+2}{1+6}=\\tfrac12,\\qquad f(1)=\\tfrac58', tex: true }, { t: '\\tfrac12<u_{n+1}\\le\\tfrac58<1', tex: true }], box: { t: '$\\tfrac12<u_n\\le1$ لكلّ $n$', c: 'grn' } },
  },
})
