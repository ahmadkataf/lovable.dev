solution('s06', {
  tag: '❽ متتالية هندسيّة مخفيّة', progress: '2 / 2',
  q: 'نتأمّل $(u_n)_{n\\ge0}$ المعرّفة تدريجيّاً وفق $u_0=s$ و $u_{n+1}=\\dfrac12u_n+n^2+n\\ \\ \\textcolor{#ff5c8a}{(*)}$<br>① عيّن كثير حدود $P$ من الدرجة الثانية بحيث تُحقّق $(t_n)_{n\\ge0}$ التي حدّها العامّ $t_n=P(n)$ العلاقة $(*)$ نفسها: $t_{n+1}=\\dfrac12t_n+n^2+n$ أيّاً كان $n$.',
  beats: {
    1: { hint: 'اكتب $P(n)=an^2+bn+c$ وعوّض في $(*)$' },
    2: { rows: [{ t: 't_{n+1}=a(n+1)^2+b(n+1)+c', tex: true }, { t: '=a\\,n^2+(2a+b)\\,n+(a+b+c)', tex: true }] },
    3: { rows: [{ t: '\\tfrac12t_n+n^2+n=\\left(\\tfrac a2+1\\right)n^2+\\left(\\tfrac b2+1\\right)n+\\tfrac c2', tex: true }] },
    4: { page: true, rows: [{ t: 'n^2:\\quad a=\\tfrac a2+1\\ \\Rightarrow\\ a=2', tex: true }, { t: 'n:\\quad 4+b=\\tfrac b2+1\\ \\Rightarrow\\ b=-6', tex: true }, { t: '1:\\quad 2-6+c=\\tfrac c2\\ \\Rightarrow\\ c=8', tex: true }],
         side: [{ type: 'chip', t: 'المطابقة: نساوي الأمثال', c: 'yel' }] },
    5: { rows: [{ t: 't_0=8,\\quad t_1=4=\\tfrac12\\times8+0\\ \\checkmark', tex: true }], box: { t: '$P(n)=2n^2-6n+8$', c: 'grn' } },
  },
})
