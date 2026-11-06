solution('s12', {
  tag: '③ · ❶', progress: '10 / 21',
  head: '③ $(v_n)_{n\\ge0}$ متتالية معرّفة تدريجيّاً وفق $v_0=1$ و $v_{n+1}=\\dfrac{v_n}{1+v_n}$.',
  q: '❶ تحقّق أنّ $v_n>0$ أيّاً كان العدد الطبيعي $n$.',
  beats: {
    1: { side: [{ type: 'tex', t: 'v_0=1\\ \\xrightarrow{\\ f(x)=\\frac{x}{1+x}\\ }\\ \\tfrac12\\ \\xrightarrow{f}\\ \\tfrac13\\ \\xrightarrow{f}\\ \\tfrac14', cls: 'mm' }] },
    2: { hint: 'التعريف بالتدريج: مهما يكن $x$ من $D$ يكن $f(x)$ من $D$',
         side: [{ type: 'chip', t: '🤔 فكّر: $v_n>0\\ \\Rightarrow\\ v_{n+1}>0$ ؟', c: 'blu' }], clear: true },
    3: { rows: ['• $v_0=1>0$'] },
    4: { rows: ['• إذا كان $v_n>0$ كان $1+v_n>1>0$، فالعدد $v_{n+1}=\\dfrac{v_n}{1+v_n}$ ناتج قسمة عدد موجب تماماً على عدد موجب تماماً، إذن $v_{n+1}>0$'] },
    5: { rows: ['• وهكذا تنتقل الموجبيّة من كلّ حدٍّ إلى الذي يليه انطلاقاً من $v_0>0$'], box: { t: '$v_n>0$ أيّاً كان $n\\in\\mathbb{N}$', c: 'grn' },
         side: [{ type: 'tex', t: '\\textcolor{#6ee05a}{v_0>0\\to v_1>0\\to v_2>0\\to\\cdots}', cls: 'mm' }, { type: 'rich', t: 'مهما يكن $x$ من $D=\\,]0,+\\infty[$ يكن $f(x)$ من $D$ ، و $v_0=1\\in D$', cls: 's', dy: 90 }], clear: true },
    6: { warn: ['<span class="mute">$v_1=\\frac12,\\ v_2=\\frac13,\\ v_3=\\frac14$</span> <span class="red b">✗ حالات خاصّة — ليست برهاناً لكلّ $n$</span>', '💡 الصياغة الرسميّة لهذا الانتقال: البرهان بالتدريج — الدرس 2'] },
  },
})
