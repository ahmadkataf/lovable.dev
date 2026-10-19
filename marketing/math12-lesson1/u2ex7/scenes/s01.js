var U2X7_18 = { type: 'graph', xmin: -6, xmax: 5, ymin: -0.5, ymax: 7, h: 380, xt: [-1], yt: [], fns: [{ f: 'x+1', c: 'blu', dash: true, from: -1.6 }, { f: '-x-1', c: 'grn', dash: true, to: -0.4 }, { f: 'sqrt(x*x+2*x+4)' }], labels: [['$\\Delta$', 4.3, 4.3, 'c', 'blu'], ["$\\Delta'$", -5.4, 3.4, 'c', 'grn']] }
solution('s01', {
  title: 'تمرينات ومسائل · القسم السابع', paper: '💡 كيف تستفيد', paperType: 'tip',
  beats: {
    0: { rows: ['📖 الكتاب ص $61$ – $62$ — التمارين من ⓲ إلى ㉑'],
         side: [{ type: 'card', kind: 'def', tag: 'في هذا القسم', t: ['توابع فيها جذر تربيعي', 'مقاربات مائلة ووضع نسبي'] }] },
    1: { rows: ['🛣️ منحنٍ واحد ← مقاربان: يميناً ويساراً'], box: { t: '$\\sqrt{x^2}=x$ يميناً ،  $-x$ يساراً', c: 'grn' }, side: [U2X7_18], clear: true },
  },
})
