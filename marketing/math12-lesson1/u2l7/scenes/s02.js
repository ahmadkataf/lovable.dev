solution('s02', {
  title: '1.7 الاستمرار عند نقطة أو على مجموعة', paper: '📘 تعريف 6', paperType: 'def',
  beats: {
    0: { rows: ['$D_f$: مجال، أو اجتماع مجالات غير مقتصرة على نقطة'] },
    1: { rows: ['$a\\in D_f$ ، $f$ مستمرّ عند $a$ ⟺'], box: { t: '$\\lim_{x\\to a}f(x)=f(a)$', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.5, xmax: 5, ymin: -0.5, ymax: 4, h: 340, xt: [[2.5, 'a']], yt: [[2.2, 'f(a)']], fns: [{ f: '1+0.6*x+0.4*sin(2*x)', from: 0, to: 5 }], pts: [[2.5, 2.2, 'c', 'yel']], tracer: { x0: 0.6, x1: 2.5 }, follow: true, fa: .1, fb: .8 }] },
    2: { rows: ['$f$ مستمرّ على $D\\subset D_f$ ⟺ مستمرّ عند كلّ نقطة من $D$'] },
    3: { page: true, rows: ['$f+g$ ، $f\\times g$ ، $\\dfrac fg$ (إذا كان معرّفاً) ، $g\\circ f$'], box: { t: 'عمليّات على توابع مستمرّة ⟸ توابع مستمرّة', c: 'grn' } },
    4: { warn: ['لا معنى لدراسة الاستمرار', 'عند نقطة خارج مجموعة التعريف'] },
  },
})
