solution('s08', {
  tag: '❹', progress: '4 / 6',
  head: 'أثبت بالتدريج صحّة الخاصّتين الآتيتين:',
  q: '① $1+2\\times2!+3\\times3!+\\cdots+n\\times n!=(n+1)!-1$   ② $n!\\ge2^{n-1}$',
  beats: {
    0: { hint: 'البداية، ثمّ: إذا صحّت عند $n$ صحّت عند $n+1$', side: [{ type: 'dominoes', n: 8, fall: 0 }] },
    1: { rows: ['① عند $n=1$: الطرف الأيسر $=1$ ، الأيمن $=2!-1=1$ ✓'], side: [{ type: 'chip', t: '$E(1)$ صحيحة ✓', c: 'grn' }], clear: true },
    2: { rows: ['نفترض $E(n)$ ونضيف الحدّ التالي $(n+1)\\times(n+1)!$:', { t: '(n+1)!-1+(n+1)(n+1)!=(n+1)!\\,\\big(1+(n+1)\\big)-1', tex: true }, { t: '=(n+2)\\times(n+1)!-1=(n+2)!-1', tex: true }],
         box: { t: '$E(n+1)$ صحيحة ← ① صحيحة لكلّ $n\\ge1$', c: 'grn' },
         side: [{ type: 'chip', t: '$(n+2)!=(n+2)\\times(n+1)!$', c: 'yel' }], clear: true },
    3: { page: true, rows: ['② عند $n=1$: $1!=1\\ge2^0=1$ ✓'] },
    4: { rows: ['نفترض $n!\\ge2^{n-1}$:', { t: '(n+1)!=(n+1)\\times n!\\ \\ge\\ (n+1)\\times2^{n-1}\\ \\ge\\ 2\\times2^{n-1}=2^n', tex: true }],
         box: { t: '② صحيحة لكلّ $n\\ge1$', c: 'grn' },
         side: [{ type: 'card', kind: 'tip', tag: 'لماذا؟', t: ['$n\\ge1\\ \\Rightarrow\\ n+1\\ge2$', 'نضرب متباينةً بعددٍ موجب'] }], clear: true },
  },
})
