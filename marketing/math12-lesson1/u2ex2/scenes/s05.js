solution('s05', {
  tag: '❺ (③)', progress: '2 / 5',
  q: '③ أثبت أنّ المعادلة $f(x)=0$ تقبل جذراً واحداً فقط. وإذا رمزنا إلى هذا الجذر بالرمز $\\alpha$، أثبت أنّ $\\alpha$ ينتمي إلى المجال $]1.6,1.7[$.',
  beats: {
    0: { rows: [{ t: U2X2_T, tex: true }] },
    1: { rows: ['على $]-\\infty,1]$: أكبر قيمة $-1<0$ ← لا جذر'], side: [{ ...U2X2_G, vband: [-1.3, 1, 'red'] }] },
    2: { page: true, rows: ['على $[1,+\\infty[$: مستمرّ ومتزايد تماماً', { t: 'f\\big([1,+\\infty[\\big)=[-2,+\\infty[\\ \\ni\\ 0', tex: true }], box: { t: 'جذر وحيد $\\alpha$', c: 'grn' },
         side: [{ ...U2X2_G, vband: [1, 2.3, 'grn'], pts: [[1.6777, 0, 'c', 'grn']], labels: [['$\\alpha$', 1.68, 0.5, 'c', 'grn']] }], clear: true },
    3: { page: true, rows: [{ t: 'f(1.6)=-0.488<0', tex: true }, { t: 'f(1.7)=0.156>0', tex: true }], box: { t: '$\\alpha\\in\\,]1.6,1.7[$', c: 'grn' } },
  },
})
