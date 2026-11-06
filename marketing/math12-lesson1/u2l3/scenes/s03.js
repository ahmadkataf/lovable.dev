solution('s03', {
  title: 'فكرة الدرس', paper: '📘 مبرهنات', paperType: 'def',
  beats: {
    0: { rows: ['نعرف $\\lim f$ و $\\lim g$ ⟸ نحسب $\\lim(f+g)$ ، $\\lim fg$ ، $\\lim\\frac fg$', 'عند $+\\infty$ أو $-\\infty$ أو عند نقطة $a$'] },
    1: { rows: ['$\\ell$ ، $\\ell\'$: أعداد حقيقيّة', '<span style="color:#ff5c8a">الخانات الحمراء ؟</span>: حالات عدم التعيين'], box: { t: 'بقيّة الحالات: نتائج سهلة التوقّع حدسيّاً', c: 'yel' } },
    2: { page: true, rows: [{ t: '\\lim_{x\\to1}f(x)=+\\infty,\\ \\ \\lim_{x\\to1}g(x)=3\\ \\Rightarrow\\ \\lim_{x\\to1}(f+g)(x)=+\\infty', tex: true }], box: { t: 'عدد هائل $+\\,3$ = عدد هائل', c: 'grn' } },
  },
})
