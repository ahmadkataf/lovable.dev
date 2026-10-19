solution('s02', {
  title: 'تذكير: $n!$ وأدوات الاطّراد', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: 'n!=n\\times(n-1)\\times\\cdots\\times2\\times1', tex: true }, { t: '4!=4\\times3\\times2\\times1=24', tex: true }, { t: '0!=1', tex: true }],
         side: [{ type: 'tex', t: '\\begin{array}{c|c}n&n!\\\\\\hline 0&1\\\\1&1\\\\2&2\\\\3&6\\\\4&24\\\\5&120\\end{array}', cls: 'mm' }] },
    1: { rows: [{ t: '(n+1)!=(n+1)\\times n!', tex: true, cls2: 'ml' }], box: { t: 'مثال: $5!=5\\times4!=5\\times24=120$', c: 'yel' } },
    2: { page: true, rows: ['① إشارة الفرق $u_{n+1}-u_n$', '② اطّراد التابع $f$ عندما $u_n=f(n)$', '③ النسبة $\\dfrac{u_{n+1}}{u_n}$ مع $1$ (حدود موجبة تماماً)', '④ البرهان بالتدريج'],
         side: [{ type: 'card', kind: 'tip', tag: 'تذكّر', t: ['متزايدة تماماً: $u_{n+1}>u_n$', 'متناقصة تماماً: $u_{n+1}<u_n$'] }], clear: true },
  },
})
