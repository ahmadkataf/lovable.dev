var U2X6_8 = { type: 'graph', xmin: -4, xmax: 6, ymin: -8, ymax: 6, h: 380, xt: [1, 2], yt: [], fns: [{ f: 'x-2', c: 'blu', dash: true }, { f: 'x-2-1/(x-1)', n: 1000 }], vl: [[1, 'grn', '$x=1$']], labels: [['$y=x-2$', 4.6, 1.6, 'c', 'blu']] }
solution('s01', {
  title: 'تمرينات ومسائل · القسم السادس', paper: '💡 كيف تستفيد', paperType: 'tip',
  beats: {
    0: { rows: ['📖 الكتاب ص $61$ — التمرين ⓱'],
         side: [{ type: 'card', kind: 'def', tag: 'في هذا القسم', t: ['⓱ عشرة توابع', 'أفقي؟ شاقولي؟ مائل؟'] }] },
    1: { rows: ['🦴 المقاربات = هيكل الخطّ البياني'], box: { t: 'ارسمها أوّلاً ← يصير رسم المنحني سهلاً', c: 'grn' }, side: [U2X6_8], clear: true },
  },
})
