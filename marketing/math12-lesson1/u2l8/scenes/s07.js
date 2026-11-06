solution('s07', {
  title: 'مبرهنة 8: صور المجالات', paper: '📘 مبرهنة 8', paperType: 'def',
  beats: {
    0: { rows: ['$f$ مستمرّ ومطّرد تماماً على مجال $I$ ⟸ $J=f(I)$ مجال'] },
    1: { rows: [{ t: '\\begin{array}{c|c|c}I&f\\ \\text{متزايد تماماً}&f\\ \\text{متناقص تماماً}\\\\\\hline [a,b]&[f(a),f(b)]&[f(b),f(a)]\\\\ ]a,b]&]\\lim_a f,\\,f(b)]&[f(b),\\,\\lim_a f[\\\\ [a,b[&[f(a),\\,\\lim_b f[&]\\lim_b f,\\,f(a)]\\\\ ]a,b[&]\\lim_a f,\\,\\lim_b f[&]\\lim_b f,\\,\\lim_a f[\\end{array}', tex: true }] },
    2: { page: true, rows: [{ t: '\\begin{array}{c|ccccccc}x&-\\infty&&-1&&2&&+\\infty\\\\\\hline f(x)&+\\infty&\\searrow&-2&\\nearrow&4&\\searrow&3\\end{array}', tex: true }, 'ما عدد حلول المعادلة $f(x)=0$ في $\\mathbb R$؟'] },
    3: { page: true, rows: [{ t: 'I_1=\\,]-\\infty,-1]:\\ J_1=[-2,+\\infty[\\ \\ni0\\ \\Rightarrow\\ \\alpha', tex: true }, { t: 'I_2=[-1,2]:\\ J_2=[-2,4]\\ \\ni0\\ \\Rightarrow\\ \\beta', tex: true }] },
    4: { rows: [{ t: 'I_3=\\,]2,+\\infty[:\\ J_3=\\,]3,4[\\ \\not\\ni0', tex: true }], box: { t: 'للمعادلة $f(x)=0$ حلّان في $\\mathbb R$', c: 'grn' } },
  },
})
