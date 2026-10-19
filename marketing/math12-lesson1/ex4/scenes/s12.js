solution('s12', {
  tag: '⓳ (③)', progress: '5 / 5',
  q: '③ أثبت أنّ $S_n=\\cos(nx)\\times\\dfrac{\\sin(nx)}{\\sin x}$ ، أيّاً يكن $n\\ge1$ و $x\\ne k\\pi\\ (k\\in\\mathbb{Z})$.',
  beats: {
    0: { hint: '$x\\ne k\\pi$ ⟸ $\\sin x\\ne0$' },
    1: { rows: [{ t: 'n=1:\\ S_1=\\cos x=\\cos x\\times\\dfrac{\\sin x}{\\sin x}\\ \\checkmark', tex: true }] },
    2: { rows: [{ t: 'S_{n+1}=S_n+\\cos(2n+1)x=\\dfrac{\\sin nx\\cos nx+\\sin x\\cos(2n+1)x}{\\sin x}', tex: true }] },
    3: { page: true, rows: ['البسط $=$', { t: '\\cancel{\\tfrac12\\sin2nx}+\\tfrac12\\sin2(n+1)x-\\cancel{\\tfrac12\\sin2nx}=\\tfrac12\\sin2(n+1)x', tex: true }] },
    4: { rows: [{ t: '\\tfrac12\\sin2(n+1)x=\\sin(n+1)x\\cdot\\cos(n+1)x', tex: true }], box: { t: '$S_{n+1}=\\cos(n+1)x\\times\\dfrac{\\sin(n+1)x}{\\sin x}$ ✓', c: 'grn' } },
  },
})
