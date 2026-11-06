solution('s09', {
  tag: 'تدرَّبْ', progress: '1 / 3', ring: 'card',
  q: 'نتأمّل التابع $f$ المعطى وفق $f(x)=\\sqrt{1-\\cos x}$.<br>① ما مجموعة تعريف $f$؟   ② أيكون $f$ مستمرّاً على مجموعة تعريفه؟   ③ بيّن أنّ التابع $f$ زوجي ويقبل العدد $2\\pi$ دوراً له.',
  beats: {
    1: { rows: [{ t: '\\cos x\\le1\\ \\Rightarrow\\ 1-\\cos x\\ge0', tex: true }], box: { t: '① $D_f=\\mathbb R$', c: 'grn' } },
    2: { rows: ['$1-\\cos x$ مستمرّ على $\\mathbb R$ ، و $\\sqrt{\\ }$ مستمرّ على مجموعة تعريفه'], box: { t: '② $f$ مستمرّ على $\\mathbb R$ (تركيب)', c: 'grn' } },
    3: { page: true, rows: [{ t: 'f(-x)=\\sqrt{1-\\cos(-x)}=\\sqrt{1-\\cos x}=f(x)', tex: true }, { t: 'f(x+2\\pi)=\\sqrt{1-\\cos(x+2\\pi)}=f(x)', tex: true }], box: { t: '③ زوجي، ودوره $2\\pi$', c: 'grn' } },
  },
})
