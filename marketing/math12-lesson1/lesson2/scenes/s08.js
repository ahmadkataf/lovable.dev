solution('s08', {
  tag: 'مثال 1', head: 'الكتاب ص 13',
  q: 'أثبت أنّه مهما كان العدد الطبيعي الموجب تماماً $n$ كان $1^3+2^3+\\cdots+n^3=\\dfrac{n^2(n+1)^2}{4}$',
  beats: {
    0: { hint: 'اكتب الخطوة ⓪ وحدك' },
    1: { rows: ['⓪ الخاصّة $E(n)$: $1^3+\\cdots+n^3=\\dfrac{n^2(n+1)^2}{4}$ ، في حالة $n\\ge1\\ (=n_0)$'] },
    2: { rows: ['① $E(1)$ صحيحة: $1^3=\\dfrac{1^2(1+1)^2}{4}=\\dfrac44=1$'] },
    3: { rows: ['② نفترض أنّ $E(n)$ صحيحة. عندئذٍ:', { t: '1^3+\\cdots+n^3+(n+1)^3=\\underbrace{1^3+\\cdots+n^3}+\\textcolor{#ff5c8a}{(n+1)^3}', tex: true }] },
    4: { rows: [{ t: '=\\dfrac{n^2(n+1)^2}{4}+\\textcolor{#ff5c8a}{(n+1)^3}', tex: true }], side: [{ type: 'card', kind: 'tip', tag: '⭐', t: ['هنا استعملنا الافتراض $E(n)$'] }] },
    5: { rows: [{ t: '=\\dfrac{(n+1)^2}{4}\\left(n^2+4(n+1)\\right)=\\dfrac{(n+1)^2}{4}\\left(n^2+4n+4\\right)', tex: true }], side: [{ type: 'chip', t: 'عامل مشترك: $\\dfrac{(n+1)^2}{4}$', c: 'yel' }], clear: true },
    6: { rows: [{ t: '=\\dfrac{(n+1)^2(n+2)^2}{4}', tex: true }], side: [{ type: 'chip', t: '$n^2+4n+4=(n+2)^2$', c: 'yel' }], clear: true },
    7: { box: { t: 'وهذه هي $E(n+1)$، إذن $E(n)$ صحيحة مهما كان العدد الطبيعي الموجب تماماً $n$', c: 'grn' },
         side: [{ type: 'tex', t: 'E(n+1):\\ \\dfrac{(\\textcolor{#ffd23f}{n+1})^2(\\textcolor{#ffd23f}{n+1}+1)^2}{4}', cls: 'mm' }], clear: true },
  },
})
