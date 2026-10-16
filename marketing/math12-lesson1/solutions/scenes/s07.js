solution('s07', {
  tag: '② · ❹ تتمّة', progress: '5 / 21', head: '② · ❹ — المجموع الثاني',
  q: 'احسب $u_2+u_4+u_6+\\cdots+u_{2n}$ ، حيث $u_n=-2\\times3^{n-1}$',
  beats: {
    0: { hint: 'الحدود ذات الدليل الزوجي: ما النسبة بين حدٍّ والذي يليه؟', side: [{ type: 'line', from: 1, to: 8, dots: [2, 4, 6, 8], arcs: [[2, 4, '× ?']] }] },
    1: { rows: ['لنرمز بـ $\\textcolor{#38bdf8}{k}$ ($k\\ge1$) إلى الدليل المتحوّل:'],
         side: [{ type: 'line', from: 1, to: 8, dots: [2, 4, 6, 8], arcs: [[2, 4, '×9'], [4, 6, '×9'], [6, 8, '×9']] }, { type: 'chip', t: '$\\times3\\times3=\\times9$', c: 'yel', dy: 270 }], clear: true },
    2: { rows: ['لدينا $u_{2k}=-2\\times3^{2k-1}$ و', { t: 'u_{2(k+1)}=u_{2k+2}=-2\\times3^{2k+1}=9\\times\\left(-2\\times3^{2k-1}\\right)=9\\,u_{2k}', tex: true }] },
    3: { rows: ['فالحدود $u_2,u_4,\\dots,u_{2n}$ هي $n$ حدّاً متتالياً من متتالية هندسيّة أساسها $9\\ne1$ وأوّلها $u_2=-2\\times3=-6$'],
         side: [{ type: 'tex', t: '\\underbrace{u_2,\\ u_4,\\ u_6,\\ \\dots,\\ u_{2n}}_{\\text{حدّاً}\\ n}', cls: 'mm' }], clear: true },
    4: { rows: [{ t: 'u_2+u_4+\\cdots+u_{2n}=-6\\times\\dfrac{1-9^n}{1-9}=-6\\times\\dfrac{1-9^n}{-8}=\\dfrac34\\left(1-9^n\\right)', tex: true }],
         box: { t: '$u_2+u_4+\\cdots+u_{2n}=\\dfrac34\\left(1-9^n\\right)$', c: 'grn' } },
    5: { rows: [{ t: 'تحقّق ($n=2$): $u_2+u_4=-6-54=-60=\\dfrac34\\,(1-81)$ ✓', cls: 'grn' }] },
    6: { warn: ['الأساس $q^2=9$ لا $3$', 'عدد الحدود $n$ لا $2n$'] },
  },
})
