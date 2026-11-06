solution('s04', {
  tag: '② · ❷', progress: '3 / 21', head: '② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة:',
  q: '❷ $(u_n)_{n\\ge0}$ متتالية هندسيّة فيها $u_7=\\dfrac{1}{1080}$ و $u_{10}=\\dfrac{25}{2197}$. احسب $u_{30}$.',
  beats: {
    1: { hint: '$u_m=u_p\\,q^{m-p}$', side: [{ type: 'line', from: 7, to: 30, ticks: [7, 10, 20, 30], dots: [7, 10, 30] }] },
    2: { rows: [{ t: 'u_{10}=u_7\\,q^{10-7}\\ \\Rightarrow\\ q^3=\\dfrac{u_{10}}{u_7}=\\dfrac{25}{2197}\\times1080=\\dfrac{27000}{2197}', tex: true }],
         side: [{ type: 'line', from: 7, to: 30, ticks: [7, 10, 20, 30], dots: [7, 10, 30], arcs: [[7, 10, '×q³']] }], clear: true },
    3: { rows: ['ولكن $27000=30^3$ و $2197=13^3$، إذن', { t: 'q^3=\\left(\\dfrac{30}{13}\\right)^3\\ \\Rightarrow\\ \\textcolor{#ffd23f}{q=\\dfrac{30}{13}}', tex: true }],
         side: [{ type: 'chip', t: 'الأُس $3$ فرديّ: حلّ حقيقي وحيد', c: 'blu' }], clear: true },
    4: { rows: [{ t: 'u_{30}=u_{10}\\,q^{30-10}=\\dfrac{25}{2197}\\left(\\dfrac{30}{13}\\right)^{20}', tex: true }],
         side: [{ type: 'line', from: 7, to: 30, ticks: [7, 10, 20, 30], dots: [10, 30], arcs: [[10, 30, '×q²⁰']] }], clear: true },
    5: { rows: [{ t: '=\\dfrac{25\\times30^{20}}{\\textcolor{#ffd23f}{13^{3}}\\times13^{20}}', tex: true }] },
    6: { rows: [{ t: '=\\dfrac{25\\times30^{20}}{13^{23}}', tex: true }], box: { t: '$u_{30}=\\dfrac{25}{2197}\\left(\\dfrac{30}{13}\\right)^{20}=\\dfrac{25\\times30^{20}}{13^{23}}$', c: 'grn' },
         side: [{ type: 'chip', t: 'للاطّلاع فقط: $u_{30}\\approx208\\,769.96$', c: 'blu' }], clear: true },
    7: { warn: ['$q^3=\\dfrac{u_{10}}{u_7}$ ✓ — $u_{10}-u_7$ ✗', 'الأُس $=30-10=20$ (لا $30$)'] },
  },
})
