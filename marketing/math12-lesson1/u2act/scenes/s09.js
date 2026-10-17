solution('s09', {
  title: 'نشاط 2 · ❹ النهاية الثانية', paper: '🧪 نشاط 2', paperType: 'think',
  beats: {
    0: { rows: [{ t: '\\lim_{h\\to0}\\frac{\\cos h-1}{h^2}', tex: true }, 'حالة $\\frac00$'] },
    1: { rows: ['$\\cos h=1-2\\sin^2\\frac h2$:', { t: '\\frac{\\cos h-1}{h^2}=-\\frac{2\\sin^2(h/2)}{4\\times(h/2)^2}=-\\frac12\\left(\\frac{\\sin(h/2)}{h/2}\\right)^2', tex: true }] },
    2: { rows: [], box: { t: '$\\lim_{h\\to0}\\dfrac{\\cos h-1}{h^2}=-\\dfrac12$', c: 'grn' } },
  },
})
