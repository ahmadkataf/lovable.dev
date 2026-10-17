solution('s05', {
  title: 'مبرهنة 2', paper: '📘 مبرهنة 2', paperType: 'def',
  beats: {
    0: { rows: ['$f$ و $g$ معرّفان على $I=\\,]b,+\\infty[$', { t: '|f(x)-\\ell|\\le g(x),\\qquad\\lim_{x\\to+\\infty}g(x)=0', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}f(x)=\\ell$', c: 'grn' } },
    1: { page: true, rows: ['الإثبات:', { t: '|f(x)-\\ell|\\le g(x)\\ \\Leftrightarrow\\ \\ell-g(x)\\le f(x)\\le\\ell+g(x)', tex: true }, 'الطرفان $\\to\\ell$ ⟸ مبرهنة الإحاطة'] },
    2: { page: true, rows: ['تبقى المبرهنتان صحيحتين:', 'عند $-\\infty$: نستبدل $]-\\infty,b[$ بـ $]b,+\\infty[$', 'عند عدد $a$: مجال $]a,B[$ أو $]A,a[$ أو $]A,B[\\setminus\\{a\\}$'] },
  },
})
