var U2X11_G = { type: 'graph', xmin: -5, xmax: 5, ymin: -7, ymax: 9, h: 400, xt: [-1, 1], yt: [1], fns: [{ f: 'x+1', c: 'blu', dash: true, from: -1 }, { f: '-x-1', c: 'grn', dash: true, to: -1 }, { f: 'abs(x+1)+x/(x*x-1)', n: 1600 }], vl: [[-1, 'mut', ''], [1, 'mut', '']] }
solution('s01', {
  title: 'تمرينات ومسائل · القسم الأخير', paper: '💡 كيف تستفيد', paperType: 'tip',
  beats: {
    0: { rows: ['📖 الكتاب ص $65$ – $66$ — التمرينان ㊲ ㊳'],
         side: [{ type: 'card', kind: 'def', tag: 'في هذا القسم', t: ['㊲ دراسة كاملة لتابع (مثل الامتحان)', '㊳ مسألة هندسيّة: نقطة متحرّكة'] }] },
    1: { rows: ['📝 نهايات ← مشتقّ ← جدول ← مقاربات ← مماس ← رسم ← معادلة'], box: { t: 'خذ وقتك، وأوقف الفيديو كثيراً', c: 'grn' }, side: [U2X11_G], clear: true },
  },
})
