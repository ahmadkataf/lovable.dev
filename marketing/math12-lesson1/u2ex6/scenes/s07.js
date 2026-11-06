solution('s07', {
  tag: '⓱ (⑧)', progress: '8 / 10', head: U2X6_H,
  q: '⑧ $f(x)=\\dfrac{x^2-3x+1}{x-1}$     (مساعدة: القسمة الإقليديّة)',
  beats: {
    1: { rows: [{ t: 'x^2-3x+1=(x-1)\\cdot x+(-2x+1)', tex: true }] },
    2: { rows: [{ t: '-2x+1=(x-1)\\cdot(-2)-1', tex: true }, { t: 'x^2-3x+1=(x-1)(x-2)-1', tex: true }],
         side: [{ type: 'tex', t: '\\begin{array}{r|l}x^2-3x+1&x-1\\\\\\hline -(x^2-x)\\phantom{+1}&x-2\\\\ -2x+1&\\\\ -(-2x+2)&\\\\ \\hline -1&\\end{array}', cls: 'mm' }] },
    3: { page: true, rows: [{ t: 'f(x)=x-2-\\dfrac{1}{x-1}', tex: true }], box: { t: 'مائل $y=x-2$ ،  شاقولي $x=1$', c: 'grn' }, side: [U2X6_8], clear: true },
  },
})
