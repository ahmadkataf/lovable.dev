solution('s09', {
  title: 'عودة إلى سؤال بداية الدرس', paper: '💡 الكتاب ص 14', paperType: 'tip',
  beats: {
    0: { rows: [{ t: '1+2+\\cdots+n=\\dfrac{n(n+1)}{2}', tex: true, cls2: 'ml' }], side: [{ type: 'card', kind: 'def', tag: 'من الدرس الأوّل', t: ['مجموع حدود متتالية حسابيّة'] }] },
    1: { rows: [{ t: '(1+2+\\cdots+n)^2=\\dfrac{n^2(n+1)^2}{4}=1^3+2^3+\\cdots+n^3', tex: true }], box: { t: 'إذن $1^3+2^3+\\cdots+n^3=(1+2+\\cdots+n)^2$ لكلّ $n\\ge1$ ✓', c: 'grn' } },
  },
})
