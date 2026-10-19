solution('s02', {
  title: 'تذكير: معادلة مستقيم', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: 'y=ax+b', tex: true, cls2: 'ml' }, '$a$: الميل ، $b$: يقطع محور التراتيب عند $b$', '$a=0$: أفقي ، $a\\ne0$: مائل'],
         side: [{ type: 'graph', xmin: -3, xmax: 4, ymin: -2, ymax: 5, h: 360, yt: [[1, 'b']], fns: [{ f: '0.8*x+1', c: 'blu' }, { f: '2.5+0*x', c: 'grn' }], labels: [['$a\\ne0$', 3, 4.3, 'c', 'blu'], ['$a=0$', -2.2, 2.9, 'c', 'grn']] }] },
  },
})
