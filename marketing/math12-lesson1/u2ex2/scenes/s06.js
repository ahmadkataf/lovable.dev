solution('s06', {
  tag: '❻ تغيير المتحوّل', progress: '3 / 5',
  q: 'نتأمّل التابع $f$ المعرّف على $\\mathbb R^*$ بالعلاقة $f(x)=\\dfrac{\\sin(3x)}{x}$. ادرس نهاية $f$ عند الصفر.<br>نحو الحلّ: نحن أمام صيغة عدم تعيين، لماذا؟',
  beats: {
    1: { rows: [{ t: '\\sin(3x)\\to0,\\quad x\\to0\\quad:\\quad\\dfrac00', tex: true }] },
    2: { page: true, rows: ['الطريقة الأولى: $X=3x$', { t: 'f(x)=3\\times\\dfrac{\\sin3x}{3x}=3\\times\\dfrac{\\sin X}{X}', tex: true }, { t: 'x\\to0\\ \\Rightarrow\\ X\\to0\\ \\Rightarrow\\ \\dfrac{\\sin X}{X}\\to1', tex: true }], box: { t: '$\\lim_{x\\to0}f(x)=3$', c: 'grn' },
         side: [{ type: 'graph', xmin: -4, xmax: 4, ymin: -1.3, ymax: 3.6, h: 360, xt: [], yt: [3], fns: [{ f: 'sin(3*x)/x', n: 801 }], pts: [[0, 3, 'o', 'yel']] }] },
    3: { page: true, rows: ['الطريقة الثانية: معدّل التغيّر', { t: 'f(x)=\\dfrac{\\sin(3x)-\\sin0}{x-0},\\qquad g(x)=\\sin3x', tex: true }, { t: "\\lim_{x\\to0}f(x)=g'(0)=3\\cos0=3", tex: true }], box: { t: 'النتيجة نفسها: $3$', c: 'grn' } },
  },
})
