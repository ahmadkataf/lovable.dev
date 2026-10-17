solution('s08', {
  tag: '⓫ (②❷)', progress: '3 / 6',
  q: '❷ أثبت أنّ $E(n)$ صحيحة، أيّاً كان العدد الطبيعي $n$ الذي يحقّق الشرط $n\\ge5$.   $E(n)$: «$3^n\\ge2^n+5\\times n^2$»',
  beats: {
    0: { hint: 'اضرب $E(n)$ بـ $3$ ، ثمّ قارن كلّ قطعة', side: [{ type: 'chip', t: '$E(5)$: $\\ 243\\ge157$ ✓', c: 'grn' }] },
    1: { rows: ['نفترض $3^n\\ge2^n+5n^2$ ، ونضرب بـ $3>0$:', { t: '3^{n+1}\\ge3\\times2^n+5\\times3n^2', tex: true }] },
    2: { rows: [{ t: '3\\times2^n>2\\times2^n=2^{n+1}', tex: true }, { t: '3n^2\\ge(n+1)^2\\quad(①,\\ n\\ge5\\ge2)', tex: true }],
         side: [{ type: 'card', kind: 'tip', tag: 'نجمع', t: ['متباينتان في الاتّجاه نفسه'] }], clear: true },
    3: { page: true, rows: [{ t: '3^{n+1}\\ge2^{n+1}+5\\,(n+1)^2', tex: true, cls2: 'ml' }], box: { t: '$E(n+1)$ صحيحة ← $E(n)$ صحيحة لكلّ $n\\ge5$', c: 'grn' },
         side: [{ type: 'dominoes', n: 8, follow: true, fa: .1, fb: .8, label: 'من 5 فصاعداً' }], clear: true },
  },
})
