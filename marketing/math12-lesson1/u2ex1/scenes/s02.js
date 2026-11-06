solution('s02', {
  title: 'أدوات سريعة', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['① أطراف مجموعة التعريف', '$D_f=\\mathbb R\\setminus\\{-3\\}$ : $-\\infty$ ، $-3^-$ ، $-3^+$ ، $+\\infty$', '$D_f=[0,+\\infty[$ : $0$ ، $+\\infty$'] },
    1: { page: true, rows: ['② عند $\\pm\\infty$: الحدود المسيطرة', '③ عدد $\\ne0$ على مقدار $\\to0$ ← $\\pm\\infty$ حسب الإشارتين'],
         side: [{ type: 'tex', t: '\\begin{array}{c|ccc}x&&a&\\\\\\hline x-a&-&0&+\\end{array}', cls: 'mm' }, { type: 'chip', t: 'لذلك: من اليمين ومن اليسار', c: 'yel', dy: 150 }] },
    2: { page: true, rows: ['④ $+\\infty-\\infty$ مع جذر: المرافق', { t: '\\sqrt A-B=\\dfrac{A-B^2}{\\sqrt A+B}', tex: true, cls2: 'ml' }], clear: true },
  },
})
