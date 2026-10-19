var U2L2_A = { xmin: -0.3, xmax: 4.5, ymin: -0.6, ymax: 8, h: 400, fns: [{ f: '1/((x-2)*(x-2))+0.5', from: -0.3, to: 1.62 }, { f: '1/((x-2)*(x-2))+0.5', from: 2.38, to: 4.5 }], xt: [[2, 'a']] }
solution('s03', {
  title: '2.1 النهاية اللانهائيّة عند عدد', paper: '📘 تعريف 3', paperType: 'def',
  beats: {
    0: { rows: ['$D_f$: مجال غير تافه أو اجتماع مجالات', '$a\\in D_f$ أو $a$ طرف لأحد مجالاته'] },
    1: { page: true, rows: ['قيم $f(x)$ تتجاوز أيّ عدد $M$ حين يقترب $x$ بما يكفي من $a$', { t: '\\lim_{x\\to a}f(x)=+\\infty', tex: true, cls2: 'ml' }], side: [{ type: 'graph', ...U2L2_A }] },
    2: { rows: ['بُعد $x$ عن $a$ أصغر من $\\alpha>0$ ⟸ $f(x)>M$'],
         side: [{ type: 'graph', ...U2L2_A, hl: [[4, 'pur', '$M$', 0]], vband: [1.465, 2.535, 'yel'], xt: [[1.465, 'a-\\alpha'], [2, 'a'], [2.535, 'a+\\alpha']] }], clear: true },
    3: { page: true, rows: ['يكافئ: مهما كبُر $M$ ، يوجد مجال مفتوح $I$ مركزه $a$:'], box: { t: '$x\\in I\\cap D_f\\ \\Rightarrow\\ f(x)>M$', c: 'yel' } },
    4: { rows: ['المستقيم $x=a$: مستقيم مقارب شاقولي لمنحني التابع'], side: [{ type: 'graph', ...U2L2_A, vl: [[2, 'grn', '$x=a$']] }], clear: true },
  },
})
