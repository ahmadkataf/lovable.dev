solution('s02', {
  tag: '①', progress: '1 / 21',
  q: '① ليكن $u_n=\\dfrac{2^n}{3^{n+1}}$ في حالة $n\\in\\mathbb{N}$. أثبت أنّ المتتالية $(u_n)_{n\\ge0}$ متتالية هندسية وجِدْ أساسها.',
  beats: {
    1: { hint: 'تعريف 3: $u_{n+1}=q\\times u_n$ أيّاً كان $n$' },
    2: { rows: ['أيّاً كان العدد الطبيعي $n$:', { t: 'u_{n+1}=\\dfrac{2^{n+1}}{3^{(n+1)+1}}=\\dfrac{2^{n+1}}{3^{\\textcolor{#ffd23f}{n+2}}}', tex: true }],
         side: [{ type: 'tex', t: 'n\\ \\longrightarrow\\ n+1', cls: 'ml' }] },
    3: { rows: [{ t: 'u_{n+1}=\\dfrac{2\\times2^{n}}{3\\times3^{n+1}}=\\textcolor{#ffd23f}{\\dfrac{2}{3}}\\times\\textcolor{#38bdf8}{\\dfrac{2^n}{3^{n+1}}}=\\textcolor{#ffd23f}{\\dfrac23}\\,u_n', tex: true }],
         side: [{ type: 'tex', t: '\\textcolor{#38bdf8}{\\dfrac{2^n}{3^{n+1}}}=u_n', cls: 'ml' }], clear: true },
    4: { box: { t: 'إذن $u_{n+1}=\\dfrac23\\,u_n$ أيّاً كان $n\\in\\mathbb{N}$، فالمتتالية $(u_n)_{n\\ge0}$ هندسيّة أساسها $q=\\dfrac23$', c: 'grn' },
         rows: [{ t: 'u_0=\\dfrac{2^0}{3^{1}}=\\dfrac13', tex: true, cls: 'mute' }] },
    5: { warn: ['<span class="mute">$\\dfrac{u_1}{u_0}=\\dfrac{u_2}{u_1}=\\dfrac23$</span> <span class="red b">✗ حالات خاصّة لا تكفي</span> — المطلوب: أيّاً كان $n$', '$u_0=\\dfrac{2^0}{3^{0+1}}=\\dfrac13$ وليس $1$'] },
  },
})
