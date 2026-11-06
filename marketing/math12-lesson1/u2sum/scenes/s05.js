solution('s05', {
  title: 'أخطاء يجب تجنّبها', paper: '⚠️ انتبه', paperType: 'warn',
  beats: {
    0: { rows: ['مستمرّ عند $a$ ⟸ اشتقاقي عند $a$ ✗', '$\\sqrt x$ و $|x|$: مستمرّان عند $0$ ، غير اشتقاقيّين عنده'],
         side: [{ type: 'graph', xmin: -3, xmax: 3, ymin: -0.5, ymax: 3, h: 340, fns: [{ f: 'abs(x)', c: 'red' }, { f: 'sqrt(x)', from: 0, c: 'grn' }], labels: [['$|x|$', -2.2, 2.6, 'c', 'red'], ['$\\sqrt x$', 2.4, 1.2, 'c', 'grn']] }] },
    1: { page: true, rows: ['صورة $[a,b]$: لا يكفي $f(a)$ و $f(b)$ (إلّا إذا كان مطّرداً)', '$x^2+1$ على $[-3,2]$: الصورة $[1,10]$ لا $[5,10]$'],
         side: [{ type: 'graph', xmin: -3.4, xmax: 2.6, ymin: -0.5, ymax: 11, h: 360, xt: [-3, 2], yt: [1, 5, 10], fns: [{ f: 'x*x+1', from: -3, to: 2 }], band: [1, 10, 'grn'] }], clear: true },
    2: { rows: [], box: { t: 'التالي: الأنشطة، ثمّ تمرينات ومسائل الوحدة الثانية', c: 'pur' } },
  },
})
