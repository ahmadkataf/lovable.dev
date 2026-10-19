solution('s08', {
  tag: '⓱', progress: '3 / 5',
  q: 'ليكن $\\theta$ عدداً حقيقيّاً من المجال $\\left]0,\\tfrac{\\pi}{2}\\right[$. ثُمّ نعرّف المتتالية $(u_n)_{n\\ge0}$ وفق $u_0=2\\cos\\theta$ و $u_{n+1}=\\sqrt{2+u_n}$ في حالة $n\\in\\mathbb{N}$.<br>① احسب $u_1$ و $u_2$. \u2003 ② أثبت بالتدريج، أنّ $u_n=2\\cos\\left(\\dfrac{\\theta}{2^n}\\right)$. \u2003 <span style="color:#6ee05a">مساعدة: $1+\\cos2\\theta=2\\cos^2\\theta$</span>',
  beats: {
    0: { hint: 'أخرج $2$ عاملاً مشتركاً تحت الجذر' },
    1: { rows: [{ t: 'u_1=\\sqrt{2+2\\cos\\theta}=\\sqrt{2\\,(1+\\cos\\theta)}', tex: true }, { t: '1+\\cos\\theta=2\\cos^2\\tfrac{\\theta}{2}\\quad\\left(\\alpha=\\tfrac{\\theta}{2}\\right)', tex: true }] },
    2: { rows: [{ t: 'u_1=\\sqrt{4\\cos^2\\tfrac{\\theta}{2}}=2\\cos\\tfrac{\\theta}{2}\\qquad u_2=2\\cos\\tfrac{\\theta}{4}', tex: true }], box: { t: '$0<\\tfrac{\\theta}{2}<\\tfrac{\\pi}{4}$ ← $\\cos\\tfrac{\\theta}{2}>0$', c: 'grn' } },
    3: { page: true, hint: 'الفكرة نفسها مع $\\alpha=\\dfrac{\\theta}{2^{n+1}}$' },
    4: { rows: ['$n=0$: $\\ 2\\cos\\dfrac{\\theta}{1}=u_0$ ✓ \u2003 نفترض $u_n=2\\cos\\dfrac{\\theta}{2^n}$', { t: 'u_{n+1}=\\sqrt{2+2\\cos\\tfrac{\\theta}{2^n}}=\\sqrt{4\\cos^2\\tfrac{\\theta}{2^{n+1}}}', tex: true }] },
    5: { rows: [{ t: '0<\\tfrac{\\theta}{2^{n+1}}<\\tfrac{\\pi}{4}\\ \\Rightarrow\\ u_{n+1}=2\\cos\\tfrac{\\theta}{2^{n+1}}', tex: true }, { t: '💡 $\\theta=\\tfrac{\\pi}{3}$: $\\ u_0=2\\cos\\tfrac{\\pi}{3}=1$ ← متتالية ⓯ نفسها!', cls: 'yel' }], box: { t: '$u_n=2\\cos\\dfrac{\\theta}{2^n}$ لكلّ $n$', c: 'grn' } },
  },
})
