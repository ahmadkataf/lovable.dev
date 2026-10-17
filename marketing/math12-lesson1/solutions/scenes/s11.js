solution('s11', {
  tag: '② · ❽', progress: '9 / 21', head: '② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة:',
  q: '❽ $a$ و $b$ و $c$ ثلاثة حدود متوالية من متتالية هندسيّة. احسبها علماً أن $abc=343$ و $a+b+c=36.75$',
  beats: {
    1: { hint: 'تعريف 3: $b=q\\times a$ و $c=q\\times b$', side: [{ type: 'tex', t: '\\dfrac bq\\ \\xrightarrow{\\times q}\\ \\textcolor{#ffd23f}{b}\\ \\xrightarrow{\\times q}\\ bq', cls: 'ml' }, { type: 'rich', t: '<span class="yel">الحدّ الأوسط</span>', cls: 's', dy: 110 }] },
    2: { rows: ['بما أنّ $abc=343\\ne0$ فلا يساوي أيٌّ من الحدود الثلاثة الصفر، ومنه $q\\ne0$. نكتب $a=\\dfrac bq$ و $c=bq$:', { t: 'abc=\\dfrac bq\\times b\\times bq=b^3=343=7^3\\ \\Rightarrow\\ \\textcolor{#ffd23f}{b=7}', tex: true }] },
    3: { rows: [{ t: '36.75=\\dfrac{147}{4}\\ ;\\ \\dfrac7q+7+7q=\\dfrac{147}{4}\\ \\Rightarrow\\ \\dfrac1q+1+q=\\dfrac{21}{4}\\ \\Rightarrow\\ q+\\dfrac1q=\\dfrac{17}{4}\\ \\Rightarrow\\ 4q^2-17q+4=0', tex: true }],
         side: [{ type: 'chip', t: '$\\div7$ ثمّ $\\times4q$', c: 'blu' }], clear: true },
    4: { rows: [{ t: '\\Delta=17^2-4\\times4\\times4=289-64=225=15^2\\ ,\\ q=\\dfrac{17\\pm15}{8}\\ \\Rightarrow\\ q=4\\ \\text{ أو }\\ q=\\dfrac14', tex: true }] },
    5: { rows: ['$q=4$: $a=\\frac74,\\ b=7,\\ c=28$ ، $q=\\frac14$: $a=28,\\ b=7,\\ c=\\frac74$'],
         box: { t: '$(a,b,c)=\\left(\\dfrac74,\\,7,\\,28\\right)$ أو $(a,b,c)=\\left(28,\\,7,\\,\\dfrac74\\right)$', c: 'grn' },
         side: [{ type: 'rich', t: '<span class="grn">✓ $\\frac74\\times7\\times28=343$ و $\\frac74+7+28=\\frac{147}{4}=36.75$</span>', cls: 's' }], clear: true },
    6: { warn: ['$ac=b^2\\ \\Rightarrow\\ abc=b^3$', 'اكتب الحلّين: $q=4$ و $q=\\frac14$'] },
  },
})
