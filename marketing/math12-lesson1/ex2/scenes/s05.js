solution('s05', {
  title: 'تذكير: المطابقة', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: 'P(n)=an^2+bn+c\\qquad(a\\ne0)', tex: true }, { t: '(n+1)^2=n^2+2n+1', tex: true }, { t: 'P(n+1)=a(n+1)^2+b(n+1)+c', tex: true }],
         side: [{ type: 'card', kind: 'tip', tag: 'قاعدة', t: ['ضع $(n+1)$ مكان كلّ $n$'] }] },
    1: { page: true, rows: ['إذا كان $an^2+bn+c=0$ أيّاً كان $n$:', '$n=0$: $\\ c=0$', '$n=1$: $\\ a+b=0$ \u2003 $n=2$: $\\ 4a+2b=0$'], box: { t: '$a=b=c=0$', c: 'yel' },
         side: [{ type: 'tex', t: '\\begin{aligned}4a+2b&=0\\\\-\\ 2(a+b)&=0\\\\\\hline 2a&=0\\end{aligned}', cls: 'mm' }], clear: true },
    2: { rows: [{ t: 'an^2+bn+c=a\'n^2+b\'n+c\'\\ \\ \\forall n\\ \\Longleftrightarrow\\ a=a\',\\ b=b\',\\ c=c\'', tex: true }], box: { t: 'المطابقة: نساوي الأمثال', c: 'grn' } },
  },
})
