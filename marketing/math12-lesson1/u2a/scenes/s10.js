var U2A_SQ = { xmin: -3, xmax: 4.4, ymin: -1.5, ymax: 17.5, h: 400, xt: [-2, 2, 4], yt: [4, 16], fns: [{ f: 'x*x' }] }
solution('s10', {
  title: 'نشاط 2 · ❷ صورة مجال', paper: '📘 تعريف', paperType: 'def',
  beats: {
    0: { rows: ['صورة مجال $I$ وفق $f$: مجموعة الأعداد $f(x)$ عندما $x$ يأخذ كلّ القيم في $I$'], box: { t: 'نرمز إليها بالرمز $f(I)$', c: 'yel' } },
    1: { page: true, rows: ['① $f:x\\mapsto x^2$ مستمرّ على $\\mathbb R$ ، فهو مستمرّ على كلّ مجال', '② عيّن صورة: $[0,2]$ ، $[-2,2]$ ، $[-2,4]$ ، $]-\\infty,2]$ ، $\\mathbb R$'],
         side: [{ type: 'graph', ...U2A_SQ }] },
    2: { page: true, rows: [{ t: 'f([0,2])=[0,4]', tex: true }, { t: 'f([-2,2])=[0,4]', tex: true }, 'المربّع لا يكون سالباً، وأصغر قيمة $0$ عند $0$'],
         side: [{ type: 'graph', ...U2A_SQ, vband: [-2, 2, 'yel'], band: [0, 4, 'grn'] }], clear: true },
    3: { rows: [{ t: 'f([-2,4])=[0,16]', tex: true }, { t: 'f(]-\\infty,2])=[0,+\\infty[\\qquad f(\\mathbb R)=[0,+\\infty[', tex: true }],
         side: [{ type: 'graph', ...U2A_SQ, vband: [-2, 4, 'yel'], band: [0, 16, 'grn'] }], clear: true },
    4: { box: { t: 'في كلّ حالة: $f(I)$ مجال (قطعة واحدة بلا ثقوب)', c: 'grn' } },
  },
})
