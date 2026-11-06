solution('s02', {
  title: 'تذكير: الجذر التربيعي', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: '\\sqrt4=2\\quad(2\\ge0,\\ 2^2=4)', tex: true }, '$\\sqrt{A}$ معرّف عندما $A\\ge0$'], box: { t: '$0\\le a<b\\ \\Rightarrow\\ \\sqrt a<\\sqrt b$', c: 'yel' },
         side: [{ type: 'plot', pts: [[0, 0], [1, 1], [4, 2], [9, 3]], xmax: 10, ymax: 3.5, c: 'blu' }] },
  },
})
