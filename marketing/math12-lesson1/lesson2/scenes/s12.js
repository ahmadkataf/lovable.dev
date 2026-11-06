solution('s12', {
  title: 'إغلاق سؤالي الدرس الأوّل', paper: '🔓 السؤالان المفتوحان', paperType: 'think',
  beats: {
    0: { rows: [{ t: 'E(n):\\quad 1+3+5+\\cdots+(2n-1)=n^2', tex: true }], side: [{ type: 'chip', t: '📖 الكتاب ص 6 — انطلاقة نشطة', c: 'blu' }] },
    1: { rows: ['① $E(1)$: $1=1^2$ ✓'] },
    2: { rows: ['② نفترض $E(n)$. العدد الفرديّ التالي $2n+1$:', { t: '\\underbrace{1+3+\\cdots+(2n-1)}_{n^2}+(2n+1)=n^2+2n+1=(n+1)^2', tex: true }], box: { t: '✓ صحيحة لكلّ $n\\ge1$', c: 'grn' }, side: [{ type: 'tex', t: '(n+1)^2=n^2+2n+1', cls: 'mm' }], clear: true },
    3: { page: true, rows: [{ t: 'u_0=3,\\qquad u_{n+1}=u_n^2-2', tex: true }, 'هل آحاد $u_n$ تساوي $7$ مهما يكن $n\\ge1$؟'], side: [{ type: 'chip', t: '📖 الكتاب ص 8 — فكّر', c: 'blu' }], clear: true },
    4: { rows: ['① $u_1=3^2-2=7$ ✓', '② إذا انتهى $u_n$ بـ $7$: $u_n^2$ ينتهي بـ $9$ (لأنّ $7\\times7=49$)، فـ $u_n^2-2$ ينتهي بـ $7$'], box: { t: '✓ آحاد $u_n$ تساوي $7$ لكلّ $n\\ge1$', c: 'grn' },
         side: [{ type: 'tex', t: '\\dots7\\ \\xrightarrow{(\\ )^2}\\ \\dots9\\ \\xrightarrow{-2}\\ \\dots7', cls: 'mm' }], clear: true },
  },
})
