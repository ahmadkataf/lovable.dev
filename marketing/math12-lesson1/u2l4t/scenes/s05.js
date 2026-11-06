solution('s05', {
  tag: 'تدرَّبْ ❶ · ⑤', progress: '1 / 2', ring: 'card',
  q: '⑤ أثبت أنّ $x^2-5\\sin x\\ge x^2-5$ ، أيّاً كان العدد الحقيقي $x$. استنتج من المتراجحة السابقة نهاية $x\\mapsto x^2-5\\sin x$ عند $+\\infty$ وعند $-\\infty$.',
  beats: {
    1: { rows: [{ t: '\\sin x\\le1\\ \\Rightarrow\\ -5\\sin x\\ge-5\\ \\Rightarrow\\ x^2-5\\sin x\\ge x^2-5', tex: true }], box: { t: 'الضرب بـ $-5$ يقلب الجهة', c: 'yel' } },
    2: { rows: [{ t: '\\lim_{x\\to\\pm\\infty}(x^2-5)=+\\infty', tex: true }], box: { t: '$\\lim_{x\\to+\\infty}(x^2-5\\sin x)=\\lim_{x\\to-\\infty}(x^2-5\\sin x)=+\\infty$', c: 'grn' },
         side: [{ type: 'graph', xmin: -7, xmax: 7, ymin: -8, ymax: 30, h: 360, fns: [{ f: 'x*x-5*sin(x)', n: 500 }, { f: 'x*x-5', c: 'blu', dash: true }] }] },
  },
})
