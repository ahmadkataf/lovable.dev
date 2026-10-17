solution('s10', {
  title: 'تذكير: المضاعفات', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['$N$ مضاعفٌ للعدد $7$ ⟺ $N=7k$ حيث $k$ عدد صحيح', '$0=7\\times0$: الصفر مضاعفٌ لكلّ عدد'], side: [{ type: 'line', from: 0, to: 35, ticks: [0, 7, 14, 21, 28, 35], dots: [0, 7, 14, 21, 28, 35] }] },
    1: { rows: [{ t: '7k+7k\'=7(k+k\'),\\qquad m\\times7k=7(mk)', tex: true }], box: { t: '$14+21=35$: كلّها مضاعفات $7$', c: 'yel' } },
    2: { page: true, rows: ['العبارة عند $n+1$ $=$ (عدد) $\\times$ العبارة عند $n$ $+$ (مضاعف)'], box: { t: 'مضاعف + مضاعف = مضاعف', c: 'grn' } },
  },
})
