solution('s05', {
  tag: 'تدرَّبْ ❹', progress: '4 / 7', ring: 'card',
  q: 'ليكن $f$ التابع المعرّف على المجال $I=[2,3]$ وفق $f(x)=\\dfrac{1}{x-1}$.   ① ارسم خطّه البياني $\\mathcal C_f$ ، واحسب $f(I)$.   ② ما عدد حلول المعادلة $f(x)=\\dfrac34$ في المجال $I$؟',
  beats: {
    1: { rows: ['مستمرّ ومتناقص تماماً على $[2,3]$'], box: { t: '① $f(I)=[f(3),f(2)]=\\left[\\tfrac12,1\\right]$', c: 'grn' },
         side: [{ type: 'graph', xmin: 1.6, xmax: 3.3, ymin: 0.3, ymax: 1.15, h: 360, ax: ['', ''], xt: [2, [2.3333, '\\tfrac73'], 3], yt: [[0.5, '\\tfrac12'], [0.75, '\\tfrac34'], [1, '1']], fns: [{ f: '1/(x-1)', from: 2, to: 3 }], hl: [[0.75, 'yel', '', 0]], pts: [[2.3333, 0.75, 'c', 'grn']] }] },
    2: { rows: [{ t: '\\tfrac34\\in\\left[\\tfrac12,1\\right]:\\quad x-1=\\tfrac43\\ \\Rightarrow\\ x=\\tfrac73', tex: true }], box: { t: '② حلّ وحيد: $x=\\tfrac73$', c: 'grn' } },
  },
})
