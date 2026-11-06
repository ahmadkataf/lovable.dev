solution('s10', {
  tag: '② · ❼', progress: '8 / 21', head: '② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة:',
  q: '❼ احسب المجموع $S=\\frac12+1+\\frac32+2+\\frac52+3+\\cdots+10$.',
  beats: {
    1: { hint: '$S=\\dfrac{n(a+\\ell)}{2}$', side: [{ type: 'tex', t: '\\tfrac12\\xrightarrow{+\\frac12}1\\xrightarrow{+\\frac12}\\tfrac32\\xrightarrow{+\\frac12}2\\ \\cdots', cls: 'mm' }] },
    2: { rows: ['كلّ حدّ يساوي سابقه مضافاً إليه $\\frac12$، فهذه حدود متتالية من متتالية حسابيّة أساسها $\\frac12$، أوّلها $a=\\frac12$ وآخرها $\\ell=10$'] },
    3: { rows: [{ t: 'S=\\dfrac{\\textcolor{#38bdf8}{1}}{2}+\\dfrac{\\textcolor{#38bdf8}{2}}{2}+\\dfrac{\\textcolor{#38bdf8}{3}}{2}+\\dfrac{\\textcolor{#38bdf8}{4}}{2}+\\cdots+\\dfrac{\\textcolor{#38bdf8}{20}}{2}', tex: true }, 'عدد الحدود $=20$'],
         side: [{ type: 'chip', t: 'البسوط: $1,2,3,\\dots,20$ ← $20$ حدّاً', c: 'blu' }], clear: true },
    4: { rows: [{ t: 'S=\\dfrac{20\\left(\\frac12+10\\right)}{2}=10\\times\\dfrac{21}{2}=105', tex: true }], box: { t: '$S=105$', c: 'grn' } },
    5: { rows: [{ t: 'طريقة ثانية: $S=\\dfrac12\\,(1+2+\\cdots+20)=\\dfrac12\\times\\dfrac{20\\times21}{2}=\\dfrac12\\times210=105$ ✓', cls: 'blu' }],
         side: [{ type: 'chip', t: '$1+2+\\cdots+n=\\dfrac{n(n+1)}{2}$', c: 'pur' }], clear: true },
    6: { warn: ['$20$ حدّاً لا $10$', 'الأعداد الصحيحة $1,2,\\dots,10$ هي حدٌّ من كلّ حدّين'] },
  },
})
