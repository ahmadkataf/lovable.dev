solution('s02', {
  tag: '❾', progress: '1 / 6',
  q: 'نُعطى عددين حقيقيّين $a$ و $b$ ونفترض أنّ $a\\ne1$. نتأمّل المتتالية $(v_n)_{n\\ge0}$ التي تحقّق $v_{n+1}=a\\,v_n+b$ ، أيّاً كان العدد الطبيعي $n$.<br>① عيّن تابعاً $f$ يحقّق $v_{n+1}=f(v_n)$ أيّاً كانت قيمة $n\\ge0$.   ② احسب $\\ell$ حلّ المعادلة $f(x)=x$.',
  beats: {
    1: { hint: 'ماذا نفعل بالحدّ $v_n$ لنحصل على $v_{n+1}$؟' },
    2: { rows: [{ t: 'f(x)=a\\,x+b', tex: true, cls2: 'ml' }], box: { t: '$v_{n+1}=f(v_n)$ ✓', c: 'grn' },
         side: [{ type: 'tex', t: 'v_n\\ \\xrightarrow{\\ \\times a\\ }\\ a\\,v_n\\ \\xrightarrow{\\ +b\\ }\\ v_{n+1}', cls: 'mm' }] },
    3: { page: true, rows: [{ t: 'a\\,x+b=x\\ \\Leftrightarrow\\ x-a\\,x=b\\ \\Leftrightarrow\\ (1-a)\\,x=b', tex: true }, 'وبما أنّ $a\\ne1$ ، نقسم على $1-a\\ne0$:'], box: { t: '$\\ell=\\dfrac{b}{1-a}$', c: 'grn' } },
    4: { rows: [{ t: 'f(\\ell)=\\ell', tex: true }, { t: 'رأيناه في ❶: $f(x)=\\tfrac34x+2$ ، $\\ell=\\dfrac{2}{1-\\frac34}=8$', cls: 'yel' }] },
  },
})
