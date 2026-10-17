solution('s03', {
  title: 'قبل أن نبدأ: $n$ و $E(n)$', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['$\\mathbb{N}=\\{0,1,2,3,\\dots\\}$: الأعداد الطبيعيّة', '$n$ = صندوق نضع فيه أيّ عدد طبيعي'], side: [{ type: 'line', from: 0, to: 8, dots: [0, 1, 2, 3, 4, 5, 6, 7, 8] }] },
    1: { rows: ['$E(n)$: جملة رياضيّة تتعلّق بالعدد $n$'], box: { t: '$E(n)$: «$4^n+2$ مضاعفٌ للعدد $3$»', c: 'pur' } },
    2: { page: true, rows: [{ t: '4^3=4\\times4\\times4=64', tex: true }, { t: 'a^0=1', tex: true }], side: [{ type: 'card', kind: 'tip', tag: 'الأُس', t: ['عدد مرّات الضرب بالعدد نفسه'] }], clear: true },
    3: { rows: [{ t: 'E(\\textcolor{#ffd23f}{0}):\\ 4^{\\textcolor{#ffd23f}{0}}+2=1+2=3', tex: true }, { t: 'E(\\textcolor{#ffd23f}{2}):\\ 4^{\\textcolor{#ffd23f}{2}}+2=16+2=18', tex: true }] },
    4: { page: true, rows: ['⭐ أهمّ مهارة: $E(n+1)$ = ضع $(n+1)$ مكان كلّ $n$', { t: 'E(\\textcolor{#ffd23f}{n+1}):\\quad 4^{\\textcolor{#ffd23f}{(n+1)}}+2', tex: true, cls2: 'ml' }], box: { t: 'كلّ $n$ ← $(n+1)$', c: 'yel' } },
  },
})
