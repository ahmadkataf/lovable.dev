solution('s03', {
  title: 'مبرهنة 4: نهاية التابع المركّب', paper: '📘 مبرهنة 4', paperType: 'def',
  beats: {
    0: { rows: ['(نقبلها دون إثبات)', { t: 'f(x)=g\\circ h(x)=g\\big(h(x)\\big)', tex: true }] },
    1: { rows: [{ t: '\\lim_{x\\to a}h(x)=b\\quad\\text{و}\\quad\\lim_{t\\to b}g(t)=c', tex: true }], box: { t: '$\\lim_{x\\to a}f(x)=c$', c: 'grn' },
         side: [{ type: 'card', kind: 'tip', tag: 'ملاحظة', t: ['$a$ ، $b$ ، $c$: أعداد حقيقيّة', 'أو مقادير لانهائيّة'] }] },
    2: { page: true, rows: ['① نبحث عن $b=\\lim_{x\\to a}h(x)$', '② ثمّ عن نهاية $g$ عند $b$'], box: { t: 'إلى أين تذهب الآلة الأولى؟ ثمّ ماذا تفعل الثانية هناك؟', c: 'yel' } },
  },
})
