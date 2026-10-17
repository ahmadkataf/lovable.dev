solution('s10', {
  title: 'قبل المثال الثاني: المضاعفات', paper: '🧰 مهارات سابقة', paperType: 'def',
  beats: {
    0: { rows: ['مضاعفٌ للعدد $3$ = $3\\times$ عددٍ صحيح', { t: '\\dots,\\ -6,\\ -3,\\ 0,\\ 3,\\ 6,\\ 9,\\ 12,\\ \\dots', tex: true }], side: [{ type: 'line', from: 0, to: 12, ticks: [0, 3, 6, 9, 12], dots: [0, 3, 6, 9, 12] }] },
    1: { rows: ['× عدد صحيح: $3k\\times m=3(km)$ ← مضاعف لـ $3$', 'مجموع مضاعفين: $3k+3m=3(k+m)$ ← مضاعف لـ $3$'] },
    2: { page: true, rows: [{ t: '4^{n+1}=4^n\\times4', tex: true, cls2: 'ml' }], side: [{ type: 'card', kind: 'tip', tag: 'القوى', t: ['نضرب بالأربعة مرّةً إضافيّة'] }], clear: true },
  },
})
