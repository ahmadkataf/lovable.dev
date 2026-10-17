solution('s07', {
  title: 'تذكير: جيب التمام', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['$\\cos\\alpha>0$ عندما $0<\\alpha<\\dfrac{\\pi}{2}$ \u2003 ($\\dfrac{\\pi}{2}=90^\\circ$)'] },
    1: { rows: [{ t: '\\cos2\\alpha=2\\cos^2\\alpha-1', tex: true }], box: { t: '$1+\\cos2\\alpha=2\\cos^2\\alpha$', c: 'yel' }, side: [{ type: 'chip', t: 'مساعدة الكتاب في ⓱', c: 'pur' }] },
    2: { page: true, rows: [{ t: '\\sqrt{A^2}=|A|', tex: true }, { t: '\\sqrt{4\\cos^2\\alpha}=2\\cos\\alpha\\quad(\\cos\\alpha>0)', tex: true }] },
  },
})
