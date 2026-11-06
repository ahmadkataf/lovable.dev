solution('s04', {
  title: 'النهاية $-\\infty$ عند عدد', paper: '📘 بالمماثلة', paperType: 'def',
  beats: {
    0: { rows: [{ t: '\\lim_{x\\to a}f(x)=-\\infty', tex: true, cls2: 'ml' }, 'قيم $f(x)$ سالبة وأصغر من أيّ عدد $M$ حين يقترب $x$ من $a$'],
         side: [{ type: 'graph', xmin: -1, xmax: 3, ymin: -8, ymax: 2, h: 400, xt: [[2, 'a']], fns: [{ f: '-1/(2-x)', from: -1, to: 1.88 }], hl: [[-4, 'pur', '$M$', 0]], vl: [[2, 'grn', '$x=a$']] }] },
    1: { rows: ['مهما صغُر $M<0$ ، يوجد مجال مفتوح $I$ مركزه $a$:'], box: { t: '$x\\in I\\cap D_f\\ \\Rightarrow\\ f(x)<M$ ، و $x=a$ مقارب شاقولي', c: 'yel' } },
  },
})
