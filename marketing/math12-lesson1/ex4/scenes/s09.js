solution('s09', {
  tag: '⓲', progress: '4 / 5',
  q: 'في مستوٍ $\\mathcal P$ محدَّث بمعلم متجانس، $\\mathcal H$ مجموعة النقاط $M(x,y)$ التي تحقّق $x^2-5y^2=1$. ليكن $f$ التابع الذي يقرن بكلّ نقطة $M(x,y)$ النقطة $M\'(9x+20y,\\,4x+9y)$. لتكن $S_0(1,0)$ و $S_{n+1}=f(S_n)$. أثبت أنّ $S_n$ نقطة من $\\mathcal H$ وأنّ إحداثيّاتها أعداد صحيحة.',
  beats: {
    0: { rows: ['$M(x,y)\\in\\mathcal H\\ \\Leftrightarrow\\ x^2-5y^2=1$'] },
    1: { hint: 'جرّب $S_0$ و $S_1$ أوّلاً' },
    2: { rows: [{ t: 'S_0(1,0):\\ 1-0=1\\ \\checkmark', tex: true }, { t: 'S_1(9,4):\\ 81-5\\times16=81-80=1\\ \\checkmark', tex: true }],
         side: [{ type: 'tex', t: '\\begin{array}{c|c|c}n&S_n&x^2-5y^2\\\\\\hline0&(1,0)&1\\\\1&(9,4)&1\\\\2&(161,72)&1\\end{array}', cls: 'ms' }] },
    3: { page: true, rows: [{ t: '(9x+20y)^2-5\\,(4x+9y)^2', tex: true }, { t: '=81x^2+360xy+400y^2-80x^2-360xy-405y^2', tex: true }] },
    4: { rows: [{ t: '=x^2-5y^2', tex: true }], box: { t: 'التابع $f$ لا يغيّر المقدار $x^2-5y^2$', c: 'yel' } },
    5: { page: true, rows: ['$S_0\\in\\mathcal H$ وإحداثيّاها صحيحان ✓', 'إذا كان $x_n^2-5y_n^2=1$ كان $x_{n+1}^2-5y_{n+1}^2=1$', '$x,y$ صحيحان ⟸ $9x+20y$ و $4x+9y$ صحيحان'], box: { t: '$S_n\\in\\mathcal H$ وإحداثيّاتها صحيحة لكلّ $n$', c: 'grn' } },
  },
})
