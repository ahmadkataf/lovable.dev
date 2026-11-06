solution('s02', {
  title: 'طريقة البحث عن المقاربات', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['شاقولي: قيمة ممنوعة $a$ و $\\lim_{x\\to a}f(x)=\\pm\\infty$ ← $x=a$', 'إذا انعدم البسط أيضاً: قد يكون ثقباً'] },
    1: { page: true, rows: ['أفقي: $\\lim_{x\\to\\pm\\infty}f(x)=\\ell$ ← $y=\\ell$', 'مائل: $f(x)=ax+b+\\varepsilon(x)$ و $\\varepsilon(x)\\to0$ ← $y=ax+b$'] },
    2: { page: true, rows: ['درجة البسط $=$ درجة المقام $+1$ ← القسمة الإقليديّة', { t: 'P(x)=Q(x)\\times q(x)+r(x)', tex: true }] },
  },
})
