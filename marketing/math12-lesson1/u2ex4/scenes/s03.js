solution('s03', {
  tag: '⓫ (①②)', progress: '1 / 3',
  q: 'ليكن $f$ التابع المعيّن بالعلاقة $f(x)=\\dfrac{3x^2+6x}{x^2-x-2}$.<br>① عيّن $\\mathcal D_f$ مجموعة تعريف $f$.   ② أوجد الأعداد $a$ و $b$ و $c$ التي تحقّق $f(x)=a+\\dfrac{b}{x+1}+\\dfrac{c}{x-2}$ ، أيّاً تكن $x$ من $\\mathcal D_f$.',
  beats: {
    1: { rows: [{ t: 'x^2-x-2=(x-2)(x+1)', tex: true }, '① $\\mathcal D_f=\\mathbb R\\setminus\\{-1,2\\}$'] },
    2: { page: true, rows: [{ t: 'a+\\dfrac{b}{x+1}+\\dfrac{c}{x-2}=\\dfrac{a(x+1)(x-2)+b(x-2)+c(x+1)}{(x+1)(x-2)}', tex: true }, { t: '=\\dfrac{a\\,x^2+(-a+b+c)\\,x+(-2a-2b+c)}{x^2-x-2}', tex: true }] },
    3: { page: true, rows: [{ t: '\\begin{cases}a=3\\\\-a+b+c=6\\\\-2a-2b+c=0\\end{cases}', tex: true }], box: { t: '② $a=3$ ،  $b=1$ ،  $c=8$', c: 'grn' },
         side: [{ type: 'chip', t: 'تحقّق: $x=0$ ← $3+1-4=0=f(0)$ ✓', c: 'grn' }] },
  },
})
