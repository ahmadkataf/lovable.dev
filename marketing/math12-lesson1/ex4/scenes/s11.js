solution('s11', {
  tag: '⓳ (①②)', progress: '5 / 5',
  q: 'يرمز $x$ إلى عدد حقيقي ويرمز $n$ إلى عدد طبيعي غير معدوم. نضع $S_n=\\cos x+\\cos(3x)+\\cos(5x)+\\cdots+\\cos((2n-1)x)$<br>① باستعمال دساتير مثلّثاتيّة تعرفها، أثبت أنّ: $\\sin(2a)=2\\sin a\\cos a$ و $\\sin a\\cdot\\cos b=\\tfrac12\\big(\\sin(a+b)+\\sin(a-b)\\big)$<br>② حوِّل كلّاً من $\\sin nx\\cdot\\cos nx$ و $\\sin x\\cdot\\cos((2n+1)x)$ إلى مجموع نسبتين مثلّثيّتين.',
  beats: {
    1: { hint: 'ضع $b=a$ ، ثمّ اجمع الدستورين' },
    2: { rows: [{ t: '\\sin2a=\\sin a\\cos a+\\cos a\\sin a=2\\sin a\\cos a', tex: true }, { t: '\\sin(a+b)+\\sin(a-b)=2\\sin a\\cos b', tex: true }], box: { t: '$\\sin a\\cos b=\\tfrac12\\big(\\sin(a+b)+\\sin(a-b)\\big)$', c: 'grn' } },
    3: { page: true, rows: [{ t: '\\sin nx\\cdot\\cos nx=\\tfrac12\\sin2nx', tex: true }], side: [{ type: 'chip', t: '$a=nx$', c: 'yel' }] },
    4: { rows: [{ t: '\\sin x\\cdot\\cos(2n+1)x=\\tfrac12\\big(\\sin(2n+2)x+\\sin(-2nx)\\big)', tex: true }], box: { t: '$=\\tfrac12\\big(\\sin2(n+1)x-\\sin2nx\\big)$', c: 'grn' },
         side: [{ type: 'chip', t: '$\\sin(-\\alpha)=-\\sin\\alpha$', c: 'yel' }], clear: true },
  },
})
