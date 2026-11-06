solution('s06', {
  title: 'تذكير: العمليّات على المتباينات', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: 'A\\ge B\\ \\text{ و }\\ k>0\\ \\Rightarrow\\ kA\\ge kB', tex: true }, { t: 'a\\ge b\\ \\Rightarrow\\ 3a\\ge3b', tex: true }] },
    1: { rows: [{ t: '\\left.\\begin{aligned}A&\\ge B\\\\C&\\ge D\\end{aligned}\\right\\}\\Rightarrow A+C\\ge B+D', tex: true }], box: { t: 'لإثبات $X\\ge Y$: يكفي إثبات $X-Y\\ge0$', c: 'yel' } },
  },
})
