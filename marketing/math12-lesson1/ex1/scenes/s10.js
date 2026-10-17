solution('s10', {
  tag: '❻', progress: '6 / 6',
  q: '$a$ و $b$ و $c$ ثلاثة أعداد حقيقيّة و $a\\ne0$. نعلم أنّ $a$ و $b$ و $c$ هي ثلاثة حدود متعاقبة من متتالية هندسيّة، نرمز إلى أساسها بالرمز $q$. كما نعلم أنّ $3a$ و $2b$ و $c$ هي ثلاثة حدود متوالية من متتالية حسابيّة. احسب $q$.',
  beats: {
    0: { hint: 'اكتب $b$ و $c$ بدلالة $a$ و $q$' },
    1: { rows: ['ثلاثة حدود متوالية $x,\\,y,\\,z$ من متتالية حسابيّة: $\\ 2y=x+z$'],
         side: [{ type: 'line', from: 0, to: 6, ticks: [], dots: [1, 3, 5], arcs: [[1, 3, '+r'], [3, 5, '+r']] }, { type: 'chip', t: '$y$ في المنتصف: $y=\\dfrac{x+z}{2}$', c: 'yel', dy: 250 }] },
    2: { page: true, rows: [{ t: 'b=aq,\\qquad c=aq^2', tex: true }, { t: '2\\times(2b)=3a+c\\ \\Rightarrow\\ 4aq=3a+aq^2', tex: true }],
         side: [{ type: 'tex', t: 'a,\\ \\ aq,\\ \\ aq^2', cls: 'mm' }], clear: true },
    3: { rows: [{ t: 'q^2-4q+3=0\\qquad(\\div\\,a\\ne0)', tex: true }, { t: '(q-1)(q-3)=0', tex: true }], box: { t: '$q=1$ أو $q=3$', c: 'grn' },
         side: [{ type: 'chip', t: 'عددان جداؤهما $3$ ومجموعهما $4$: $1$ و $3$', c: 'yel' }, { type: 'card', kind: 'tip', tag: 'تحقّق', t: ['$q=1$: $\\ 3a,\\,2a,\\,a$ ✓', '$q=3$: $\\ 3a,\\,6a,\\,9a$ ✓'], dy: 110 }], clear: true },
  },
})
