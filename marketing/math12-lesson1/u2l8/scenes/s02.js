var U2L8_IVT = { xmin: -0.3, xmax: 6.5, ymin: -0.2, ymax: 6, h: 380, xt: [[0.3, 'a'], [6, 'b']], yt: [[2.37, 'f(a)'], [5.21, 'f(b)'], [3.4, 'y']], fns: [{ f: '1.6+1.9*sin(1.2*x)+0.35*x', from: 0.3, to: 6 }], hl: [[3.4, 'yel', '', 0]] }
solution('s02', {
  title: '1.8 مبرهنة القيمة الوسطى', paper: '📘 مبرهنة 6', paperType: 'def',
  beats: {
    0: { rows: ['(نقبلها دون إثبات)', '$f$ مستمرّ على $[a,b]$ ، و $y$ بين $f(a)$ و $f(b)$'], box: { t: 'يوجد على الأقلّ $c$ بين $a$ و $b$ يحقّق $f(c)=y$', c: 'grn' }, side: [{ type: 'graph', ...U2L8_IVT }] },
    1: { page: true, rows: ['($f(a)\\le f(b)$): أيّاً يكن $y\\in[f(a),f(b)]$', 'للمعادلة $f(x)=y$ حلّ واحد على الأقلّ في $I=[a,b]$'] },
    2: { rows: ['كلّ $y$ صورة عدد $c$ من $I$ ، و $c$ ليس وحيداً بالضرورة'], side: [{ type: 'graph', ...U2L8_IVT, pts: [[0.62, 3.4, 'c', 'yel'], [2.47, 3.4, 'c', 'yel'], [5.11, 3.4, 'c', 'yel']] }], clear: true },
    3: { page: true, rows: [{ t: '[f(a),f(b)]\\subset f(I)', tex: true, cls2: 'ml' }, '$f(A)$: صورة المجموعة $A$ وفق $f$'] },
  },
})
