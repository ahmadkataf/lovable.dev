solution('s02', {
  title: 'تذكير: نهاية $\\sin x/x$ ، والمرافق', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: '\\lim_{x\\to0}\\frac{\\sin x}{x}=1', tex: true, cls2: 'ml' }, { t: 'x=0.1:\\ \\ \\frac{\\sin 0.1}{0.1}\\approx0.998', tex: true }],
         side: [{ type: 'graph', xmin: -7, xmax: 7, ymin: -0.5, ymax: 1.3, h: 300, yt: [1], fns: [{ f: 'x==0?1:sin(x)/x' }], pts: [[0, 1, 'o', 'yel']] }] },
    1: { page: true, rows: [{ t: '(\\sqrt A-b)(\\sqrt A+b)=A-b^2', tex: true, cls2: 'ml' }], box: { t: 'نتخلّص من الجذر', c: 'yel' } },
  },
})
