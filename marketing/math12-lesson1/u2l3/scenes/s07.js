solution('s07', {
  title: '4.3 صيغ عدم التعيين', paper: '⚠️ أربع حالات', paperType: 'warn',
  beats: {
    0: { rows: [{ t: '\\frac00\\qquad\\frac{\\pm\\infty}{\\pm\\infty}\\qquad0\\times\\pm\\infty\\qquad+\\infty-\\infty', tex: true, cls2: 'ml' }], box: { t: 'الجداول لا تجيب ← دراسة أكثر تفصيلاً', c: 'red' } },
    1: { page: true, rows: ['رموز لتسهيل الكتابة فقط، ليس لها معنى رياضي', '(لا يجوز أن يكون المقام معدوماً)'], box: { t: 'الحلّ: نعيد كتابة التابع بصيغة أخرى', c: 'grn' } },
  },
})
