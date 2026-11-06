solution('s08', {
  tag: '㉖', progress: '5 / 6',
  q: 'ليكن $f$ التابع المعرّف على $I=[0,3]$ وفق $f(x)=x^2-2x-3$.<br>① ادرس تغيّرات $f$ ونظّم جدولاً بها.   ② استنتج قيم $x$ التي تحقّق $f(x)=0$.   ③ عيّن $f([0,3])$.',
  beats: {
    1: { rows: [{ t: "f'(x)=2x-2", tex: true }, { t: '\\begin{array}{c|ccccc}x&0&&1&&3\\\\\\hline f\'(x)&&-&0&+&\\\\\\hline f(x)&-3&\\searrow&-4&\\nearrow&0\\end{array}', tex: true }],
         side: [{ type: 'graph', xmin: -0.5, xmax: 3.5, ymin: -4.6, ymax: 1, h: 360, xt: [1, 3], yt: [-3, -4], fns: [{ f: 'x*x-2*x-3', from: 0, to: 3 }], pts: [[0, -3, 'c', 'red'], [1, -4, 'c', 'red'], [3, 0, 'c', 'grn']] }] },
    2: { page: true, rows: ['على $[0,1]$: $f(x)\\le-3$ ← لا حلّ', 'على $[1,3]$: متزايد تماماً من $-4$ إلى $0$', { t: '(x-3)(x+1)=0,\\quad -1\\notin I', tex: true }], box: { t: '② $x=3$', c: 'grn' } },
    3: { page: true, rows: ['أصغر قيمة $-4$ ،  أكبر قيمة $0$', '⚠️ لا يكفي $f(0)$ و $f(3)$: التابع غير مطّرد على $I$'], box: { t: '③ $f([0,3])=[-4,0]$', c: 'grn' } },
  },
})
