solution('s08', {
  title: 'مثال: طريقة ثانية (الضرب بالمرافق)', paper: '✏️ مثال', paperType: 'ex',
  beats: {
    0: { rows: [{ t: '\\sqrt{4x+1}-3=\\frac{(4x+1)-9}{\\sqrt{4x+1}+3}=\\frac{4(x-2)}{3+\\sqrt{4x+1}}', tex: true }],
         side: [{ type: 'card', kind: 'tip', tag: 'المرافق', t: ['$(\\sqrt A-3)(\\sqrt A+3)=A-9$'] }] },
    1: { rows: [{ t: 'x>0:\\quad\\left|\\sqrt{4x+1}-3\\right|=\\frac{4|x-2|}{3+\\sqrt{4x+1}}<\\frac{4|x-2|}{3+\\sqrt{4\\times0+1}}=|x-2|', tex: true }], box: { t: 'المقام أكبر من $4$', c: 'yel' } },
    2: { page: true, rows: [{ t: '|x-2|<0.01\\ \\Rightarrow\\ \\left|\\sqrt{4x+1}-3\\right|<0.01', tex: true }, '$x\\in\\,]1.99,2.01[$ ⟸ $2.99<\\sqrt{4x+1}<3.01$'], box: { t: 'النتيجة نفسها ✓', c: 'grn' } },
  },
})
