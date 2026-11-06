solution('s08', {
  tag: '② · ❺', progress: '6 / 21', head: '② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة:',
  q: '❺ $(u_n)_{n\\ge0}$ متتالية حسابيّة أساسها $-2$ وفيها $u_0=-3$. احسب $u_{25}+u_{26}+\\cdots+u_{125}$.',
  beats: {
    1: { hint: '$S=\\dfrac{n(a+\\ell)}{2}$', side: [{ type: 'rich', t: '$a=\\ ?$ ، $\\ell=\\ ?$ ، عدد الحدود $=\\ ?$', cls: 'h3' }] },
    2: { rows: [{ t: 'u_n=u_0+n\\,r=-3-2n', tex: true }] },
    3: { rows: ['$a=u_{25}=-3-50=-53$ ؛ $\\ell=u_{125}=-3-250=-253$'],
         side: [{ type: 'rich', t: '<span class="grn">$a=-53$</span> ، <span class="grn">$\\ell=-253$</span> ، عدد الحدود $=\\ ?$', cls: 'h3' }], clear: true },
    4: { rows: ['عدد الحدود: $125-25+1=101$'],
         side: [{ type: 'line', from: 25, to: 125, ticks: [25, 50, 75, 100, 125], dots: [25, 125], brace: [25, 125, '101 حدّاً'] },
                { type: 'rich', t: '<span class="mute">مسافات $=125-25=100$</span> — <span class="yel b">أعمدة $=101$</span>', cls: 's', dy: 270 }], clear: true },
    5: { rows: [{ t: 'u_{25}+u_{26}+\\cdots+u_{125}=\\dfrac{101\\,(-53-253)}{2}=\\dfrac{101\\times(-306)}{2}=101\\times(-153)=-15453', tex: true }],
         box: { t: '$u_{25}+\\cdots+u_{125}=-15453$', c: 'grn' } },
    6: { warn: ['عدد الحدود $101$ لا $100$', 'الطرفان $u_{25}$ و $u_{125}$ محسوبان'] },
  },
})
