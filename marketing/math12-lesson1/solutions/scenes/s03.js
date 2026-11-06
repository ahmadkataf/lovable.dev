solution('s03', {
  tag: '② · ❶', progress: '2 / 21',
  head: '② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة:',
  q: '❶ $(u_n)_{n\\ge0}$ متتالية حسابيّة فيها $u_2=41$ و $u_5=-13$. احسب $u_{20}$.',
  beats: {
    1: { hint: 'الأداة: $u_m=u_p+(m-p)\\,r$ ، و $m-p$ = عدد الخطوات', side: [{ type: 'line', from: 0, to: 20, ticks: [0, 2, 5, 10, 15, 20], dots: [2, 5, 20] }] },
    2: { rows: ['من $u_2$ إلى $u_5$ ثلاث خطوات:', { t: 'u_5=u_2+(5-2)\\,r\\ \\Rightarrow\\ -13=41+3r\\ \\Rightarrow\\ 3r=-54\\ \\Rightarrow\\ r=\\textcolor{#ffd23f}{-18}', tex: true }],
         side: [{ type: 'line', from: 0, to: 20, ticks: [0, 2, 5, 10, 15, 20], dots: [2, 5, 20], arcs: [[2, 5, '3r']] }], clear: true },
    3: { rows: [{ t: 'u_{20}=u_5+(20-5)\\,r=-13+15\\times(-18)=-13-270=-283', tex: true }], box: { t: '$u_{20}=-283$', c: 'grn' },
         side: [{ type: 'line', from: 0, to: 20, ticks: [0, 2, 5, 10, 15, 20], dots: [2, 5, 20], arcs: [[2, 5, '3r']], brace: [5, 20, '15 خطوة'] }], clear: true },
    4: { warn: ['$u_5=u_2+3r$ ✓ — $u_5=u_2+5r$ ✗', 'عدد الخطوات = فرق الدليلين'], rows: [{ t: 'تحقّق: $u_{20}=u_2+18r=41-324=-283$ ✓', cls: 'grn' }] },
  },
})
