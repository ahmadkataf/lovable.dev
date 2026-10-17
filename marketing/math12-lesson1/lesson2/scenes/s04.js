solution('s04', {
  title: '1.2 أهمّيّة الإثبات بالتدريج', paper: '📖 الكتاب ص 12', paperType: 'def',
  beats: {
    0: { rows: [{ t: 'E(n):\\quad 1^3+2^3+\\cdots+n^3=(1+2+\\cdots+n)^2', tex: true }], side: [{ type: 'tex', t: '2^3=2\\times2\\times2=8', cls: 'ml' }, { type: 'card', kind: 'tip', tag: 'المكعّب', t: ['العدد × نفسه × نفسه'], dy: 120 }] },
    1: { rows: [{ t: 'E(1):\\quad 1^3=1=1^2\\ \\ \\textcolor{#6ee05a}{✓}', tex: true }] },
    2: { rows: [{ t: 'E(2):\\quad 1+8=9=(1+2)^2\\ \\ \\textcolor{#6ee05a}{✓}', tex: true }, { t: 'E(3):\\quad 1+8+27=36=(1+2+3)^2\\ \\ \\textcolor{#6ee05a}{✓}', tex: true }] },
    3: { rows: ['لكلّ $n$؟ لا نستطيع أن نجرّب عدداً لا نهائيّاً من المرّات'], box: { t: 'تذكّر $n^2+n+41$: التجارب لا تكفي', c: 'red' }, side: [{ type: 'tex', t: '\\infty', cls: 'mxl' }], clear: true },
  },
})
