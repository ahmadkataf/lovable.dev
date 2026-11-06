solution('s04', {
  tag: '❿', progress: '2 / 6',
  q: 'نتأمّل متتالية $(u_n)_{n\\ge0}$ معرّفة بالتدريج وفق: $u_0=1,\\ u_1=4$ و $u_{n+1}=5u_n-6u_{n-1}\\ \\ (n\\ge1)$<br>① عيّن عددين حقيقيّين $a$ و $b$ يحقّقان $a+b=5$ و $ab=6$.',
  beats: {
    0: { rows: [{ t: 'u_2=5\\times4-6\\times1=14', tex: true }], side: [{ type: 'card', kind: 'think', tag: 'حدّان سابقان', t: ['كلّ حدٍّ يحتاج', 'الحدّين اللذين قبله'] }] },
    1: { hint: 'جرّب أزواج الأعداد التي جداؤها $6$' },
    2: { page: true, rows: [{ t: '\\begin{array}{c|c}\\text{الجداء }6&\\text{المجموع}\\\\\\hline1\\times6&7\\\\2\\times3&\\textcolor{#6ee05a}{5}\\ \\checkmark\\end{array}', tex: true }], box: { t: '$a=2$ ، $b=3$', c: 'grn' },
         side: [{ type: 'chip', t: 'أو: $x^2-5x+6=0$', c: 'blu' }], clear: true },
    3: { page: true, rows: [{ t: '② لتكن المتتالية $(v_n)_{n\\ge0}$ ، $v_n=u_{n+1}-a\\,u_n$. أثبت أنّ $(v_n)_{n\\ge0}$ متتالية هندسيّة أساسها $b$.', cls: 'mute' }, { t: 'v_{n+1}=u_{n+2}-a\\,u_{n+1}', tex: true }, { t: '=(5u_{n+1}-6u_n)-a\\,u_{n+1}', tex: true }],
         side: [{ type: 'chip', t: '$u_{n+2}=5u_{n+1}-6u_n$', c: 'yel' }], clear: true },
    4: { page: true, rows: ['من ①: $\\ 5-a=b$ و $6=ab$', { t: 'v_{n+1}=(\\textcolor{#ffd23f}{5-a})\\,u_{n+1}-\\textcolor{#38bdf8}{6}\\,u_n=\\textcolor{#ffd23f}{b}\\,u_{n+1}-\\textcolor{#38bdf8}{ab}\\,u_n=b\\,(u_{n+1}-a\\,u_n)=b\\,v_n', tex: true }],
         box: { t: '$(v_n)$ هندسيّة أساسها $b$', c: 'grn' } },
    5: { page: true, rows: [{ t: '③ لتكن المتتالية $(w_n)_{n\\ge0}$ ، $w_n=u_{n+1}-b\\,u_n$. أثبت أنّ $(w_n)_{n\\ge0}$ متتالية هندسيّة أساسها $a$.', cls: 'mute' }, { t: 'w_{n+1}=(5-b)\\,u_{n+1}-6\\,u_n=a\\,u_{n+1}-ab\\,u_n=a\\,w_n', tex: true }], box: { t: '$(w_n)$ هندسيّة أساسها $a$', c: 'grn' } },
  },
})
