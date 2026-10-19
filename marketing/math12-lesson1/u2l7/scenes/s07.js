solution('s07', {
  title: 'مثال: تركيب توابع مستمرّة', paper: '✏️ مثال', paperType: 'ex',
  beats: {
    0: { rows: [{ t: 'f(x)=\\sqrt{x^2+4x+5},\\qquad x^2+4x+5=(x+2)^2+1>0', tex: true }] },
    1: { rows: ['$g(x)=x^2+4x+5$ مستمرّ على $\\mathbb R$ ، $h(x)=\\sqrt x$ مستمرّ على مجموعة تعريفه', { t: 'f=h\\circ g', tex: true }], box: { t: '$f$ مستمرّ على $\\mathbb R$', c: 'grn' } },
    2: { page: true, rows: [{ t: 'f(x)=\\sin x+\\cos x', tex: true }], box: { t: 'مجموع تابعين مستمرّين ⟸ مستمرّ على $\\mathbb R$', c: 'grn' } },
  },
})
