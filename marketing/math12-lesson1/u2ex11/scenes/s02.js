solution('s02', {
  title: 'تذكير سريع', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: '|x+1|=\\begin{cases}x+1&:\\ x\\ge-1\\\\-x-1&:\\ x<-1\\end{cases}', tex: true }] },
    1: { page: true, rows: ['المماس عند النقطة التي فاصلتها $a$:', { t: "y=f'(a)(x-a)+f(a)", tex: true }] },
  },
})
