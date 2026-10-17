solution('s07', {
  title: 'مهارات قبل المثال الأوّل', paper: '🧰 مهارات سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: '1^3+\\cdots+n^3+(n+1)^3=\\underbrace{1^3+\\cdots+n^3}_{\\text{حتّى }n}+\\textcolor{#ff5c8a}{(n+1)^3}', tex: true }, 'المجموع حتّى $n+1$ = المجموع حتّى $n$ + <span class="red">الحدّ الجديد</span>'] },
    1: { page: true, rows: [{ t: '\\textcolor{#ffd23f}{3}\\times5+\\textcolor{#ffd23f}{3}\\times7=\\textcolor{#ffd23f}{3}\\times(5+7)=36', tex: true }, 'نُخرج الشيء المكرَّر خارج قوس'], side: [{ type: 'card', kind: 'tip', tag: 'العامل المشترك', t: ['$a\\times b+a\\times c=a\\,(b+c)$'] }] },
    2: { page: true, rows: [{ t: '(n+2)^2=n^2+4n+4', tex: true, cls2: 'ml' }], side: [{ type: 'tex', t: '\\begin{array}{|c|c|}\\hline \\ \\ n^2\\ \\ & 2n\\\\\\hline 2n & 4\\\\\\hline\\end{array}', cls: 'ml' }, { type: 'rich', t: 'مربّع ضلعه $n+2$: $n^2+2n+2n+4$', cls: 's', dy: 170 }], clear: true },
  },
})
