solution('s10', {
  title: 'تذكير: دستورا الجيب', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: '\\sin(a+b)=\\sin a\\cos b+\\cos a\\sin b', tex: true }, { t: '\\sin(a-b)=\\sin a\\cos b-\\cos a\\sin b', tex: true }] },
    1: { rows: [{ t: '\\sin(-\\alpha)=-\\sin\\alpha', tex: true }], box: { t: '$\\sin$: الجيب ، $\\cos$: جيب التمام', c: 'yel' } },
  },
})
