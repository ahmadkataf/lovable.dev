solution('s10', {
  tag: 'نشاط 2 · ❺ تطبيق', ring: 'card',
  q: 'لنتأمّل التابع المعرّف في $D=[-\\pi,\\pi]\\setminus\\{0\\}$ بالصيغة $f(x)=\\dfrac{\\cos(3x)-\\cos x}{x\\sin x}$. استعمل أسلوب الفقرة ❹ ونتائج هذا النشاط لتحسب $\\lim_{x\\to0}f(x)$.',
  beats: {
    1: { rows: [{ t: 'f(x)=\\frac{\\frac{\\cos3x-1}{x^2}-\\frac{\\cos x-1}{x^2}}{\\frac{\\sin x}{x}}', tex: true }] },
    2: { rows: [{ t: '\\frac{\\cos3x-1}{x^2}=9\\cdot\\frac{\\cos3x-1}{(3x)^2}\\to9\\times\\left(-\\tfrac12\\right)=-\\tfrac92', tex: true }, { t: '\\frac{\\cos x-1}{x^2}\\to-\\tfrac12', tex: true }] },
    3: { rows: [{ t: '-\\tfrac92+\\tfrac12=-4', tex: true }], box: { t: '$\\lim_{x\\to0}f(x)=-4$', c: 'grn' } },
  },
})
