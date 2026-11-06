solution('s02', {
  title: 'تذكير: التحليل والاختصار', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['$P(a)=0$ ← $(x-a)$ عامل في $P(x)$', 'عند $\\dfrac00$: نحلّل ونختصر $(x-a)$'] },
    1: { page: true, rows: [{ t: 'x^2-a^2=(x-a)(x+a)', tex: true }, { t: 'x^3-1=(x-1)(x^2+x+1)', tex: true }, { t: 'x^2-6x+5=(x-1)(x-5)', tex: true }], side: [{ type: 'chip', t: 'مجموعهما $6$ وجداؤهما $5$: $1$ و $5$', c: 'yel' }] },
    2: { page: true, rows: ['عدد $\\ne0$ على مقدار $\\to0$: جدول إشارة المقام', { t: '\\begin{array}{c|ccccc}x&&1&&5&\\\\\\hline (x-1)(x-5)&+&0&-&0&+\\end{array}', tex: true }] },
  },
})
