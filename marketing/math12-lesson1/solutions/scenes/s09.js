solution('s09', {
  tag: '② · ❻', progress: '7 / 21', head: '② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة:',
  q: '❻ $(u_n)_{n\\ge0}$ متتالية هندسيّة أساسها $2$ وفيها $u_0=1$. احسب $u_3+u_4+\\cdots+u_{10}$.',
  beats: {
    1: { hint: '$S=\\textcolor{#ffd23f}{a}\\,\\dfrac{1-q^{\\textcolor{#38bdf8}{n}}}{1-q}$', side: [{ type: 'rich', t: '<span class="yel">$a$</span>: أوّل حدود المجموع — <span class="blu">$n$</span>: عدد الحدود', cls: 's' }] },
    2: { rows: [{ t: 'u_n=u_0\\,q^n=2^n', tex: true }, 'أوّل حدود المجموع $a=u_3=2^3=8$، وعدد حدوده $10-3+1=8$، والأساس $q=2\\ne1$:'],
         side: [{ type: 'line', from: 0, to: 10, dots: [3, 10], brace: [3, 10, '8 حدود'] }], clear: true },
    3: { rows: [{ t: 'u_3+u_4+\\cdots+u_{10}=8\\times\\dfrac{1-2^8}{1-2}=8\\times\\dfrac{1-256}{-1}=8\\times255=2040', tex: true }], box: { t: '$u_3+\\cdots+u_{10}=2040$', c: 'grn' } },
    4: { warn: ['$a=u_3=8$ لا $u_0$', 'الأُس $8$ (عدد الحدود) لا $10$'],
         rows: [{ t: 'تحقّق: $8+16+32+64+128+256+512+1024=2040$ ✓', cls: 'grn' }] },
  },
})
