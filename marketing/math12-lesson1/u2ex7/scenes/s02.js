solution('s02', {
  title: 'تذكير: الجذر والمقارب المائل', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: [{ t: 'x^2+bx+c=\\Big(x+\\tfrac b2\\Big)^2+k', tex: true }, { t: '\\sqrt{x^2+bx+c}\\ \\approx\\ \\Big|x+\\tfrac b2\\Big|', tex: true }] },
    1: { page: true, rows: [{ t: '\\sqrt{u^2+k}-u=\\dfrac{k}{\\sqrt{u^2+k}+u}\\to0', tex: true }, 'أو: $a=\\lim\\dfrac{f(x)}{x}$ ثمّ $b=\\lim\\big(f(x)-ax\\big)$'] },
  },
})
