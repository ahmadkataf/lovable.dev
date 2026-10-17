solution('s06', {
  title: '2.4 مبرهنة المقارنة عند اللانهاية', paper: '📘 مبرهنة 3', paperType: 'def',
  beats: {
    0: { rows: ['① $f(x)\\ge g(x)$ على $]b,+\\infty[$ و $\\lim_{x\\to+\\infty}g(x)=+\\infty$'], box: { t: '$\\lim_{x\\to+\\infty}f(x)=+\\infty$', c: 'grn' },
         side: [{ type: 'graph', xmin: -0.5, xmax: 14, ymin: -1, ymax: 9, h: 380, fns: [{ f: '0.5*x', c: 'blu' }, { f: '0.5*x+1+0.8*sin(2*x)', c: 'red', n: 600 }], labels: [['$g$', 12, 5, 'c', 'blu'], ['$f$', 10, 7.6, 'c', 'red']] }] },
    1: { rows: ['② $f(x)\\le g(x)$ و $\\lim_{x\\to+\\infty}g(x)=-\\infty$ ⟸ $\\lim_{x\\to+\\infty}f(x)=-\\infty$'], box: { t: 'فوق تابع يصعد بلا حدود ⟸ يصعد معه', c: 'yel' } },
    2: { page: true, rows: ['الإثبات: كلّ مجال $]M,+\\infty[$ يحوي قيم $g(x)$ عندما $x>A$ ($A>b$)', '$f(x)\\ge g(x)$ ⟸ يحوي قيم $f(x)$ أيضاً'], box: { t: '$\\lim_{x\\to+\\infty}f(x)=+\\infty$ (التعريف 2)', c: 'grn' } },
  },
})
