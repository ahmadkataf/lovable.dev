var U2X9_FP = { type: 'graph', xmin: -0.12, xmax: 1.2, ymin: -0.12, ymax: 1.2, h: 380, xt: [1], yt: [1], segs: [[0, 1, 1, 1, 'mut', true], [1, 0, 1, 1, 'mut', true]], fns: [{ f: 'x', c: 'blu', dash: true, from: 0, to: 1 }, { f: 'cos(x)', from: 0, to: 1 }], pts: [[0.7391, 0.7391, 'c', 'yel']], labels: [['$y=x$', 0.95, 0.75, 'c', 'blu'], ['$a$', 0.74, 0.9, 'c', 'yel']] }
solution('s01', {
  title: 'تمرينات ومسائل · القسم التاسع', paper: '💡 كيف تستفيد', paperType: 'tip',
  beats: {
    0: { rows: ['📖 الكتاب ص $63$ – $64$ — التمارين من ㉘ إلى ㉝'],
         side: [{ type: 'card', kind: 'def', tag: 'في هذا القسم', t: ['㉘ ㉙ الاستمرار عند نقطة', '㉚ ㉛ الجزء الصحيح $E(x)$', '㉜ حلّ معادلة بالرسم والحساب', '㉝ النقطة الثابتة'] }] },
    1: { rows: ['📍 تابع مستمرّ يأخذ $[0,1]$ إلى نفسه'], box: { t: 'يترك نقطة في مكانها: $f(a)=a$', c: 'grn' }, side: [U2X9_FP], clear: true },
  },
})
