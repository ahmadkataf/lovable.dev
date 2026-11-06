scene('s15', {
  build(root, S) {
    this.h = heading(root, '④ ادرس جهة اطّراد كلٍّ من المتتاليات الآتية.')
    const items = [
      ['❶', 'u_n=\\dfrac{3}{n^2}'], ['❷', 'u_n=\\sqrt{3n+1}'], ['❸', 'u_n=\\dfrac{2n-1}{n+4}'],
      ['❹', 'u_n=\\dfrac{1}{n^2+1}'], ['❺', 'u_n=\\dfrac{3n+1}{n-2}'], ['❻', 'u_n=\\dfrac{n}{10^n}'],
      ['❼', '\\begin{cases}u_0=2,\\\\ u_{n+1}=u_n-3\\end{cases}'], ['❽', '\\begin{cases}u_0=1,\\\\ u_{n+1}=\\frac12u_n\\end{cases}'], ['❾', '\\begin{cases}u_0=1,\\\\ u_{n+1}=2u_n\\end{cases}'],
    ]
    this.grid = el('div', '', null, root); place(this.grid, 960, 300, { anchor: 'tc', w: 1500 })
    this.grid.style.cssText += 'display:grid;grid-template-columns:repeat(3,1fr);gap:22px 30px;direction:rtl'
    this.cells = items.map(([n, t]) => {
      const c = el('div', '', null, this.grid)
      c.style.cssText = 'display:flex;align-items:center;gap:18px;justify-content:flex-start;padding:14px 22px;border-radius:18px;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.1);min-height:120px'
      el('span', 'h3 pur', n, c).style.fontWeight = 900
      c.appendChild(tex(t, 'mm'))
      return c
    })
    this.q1 = chip(root, rich('أوّلاً: أين الصيغة معرّفة؟ ← $n_0$', 's').outerHTML, 1350, 830, { anchor: 'c', color: C.yel })
    this.q2 = chip(root, rich('ثانياً: هل الحدود موجبة تماماً؟ ← طريقة النسبة', 's').outerHTML, 640, 830, { anchor: 'c', color: C.yel })
    ;[this.q1, this.q2].forEach(c => { c.style.color = C.ink })
    this.methods = ['إشارة الفرق: $u_{n+1}-u_n$', 'اطّراد التابع: $u_n=f(n)$ ودراسة $f$ على $[n_0,+\\infty[$', 'مقارنة النسبة بالواحد: $\\dfrac{u_{n+1}}{u_n}$ و $1$ (حدود موجبة تماماً)'].map((t, i) => {
      const c = card(root, 'def', 1800 - i * 560, 330, 520, { anchor: 'tr', tag: ['①', '②', '③'][i] + ' طريقة' })
      c.body.appendChild(rich(t, 'p')).style.fontSize = '34px'
      return c.el
    })
    const ex = card(root, 'exam', 960, 320, 1300, { anchor: 'tc', tag: '🎯 على ورقة الامتحان' })
    this.steps = ['1. مجموعة التعريف ← $n_0$', '2. الحساب (الفرق / المشتق / النسبة)', '3. جملة الجواب: فالمتتالية $(u_n)_{n\\ge n_0}$ …'].map(t => { const e = rich(t, 'h3'); e.style.margin = '10px 0'; ex.body.appendChild(e); return e })
    this.ex = ex.el
  },
  render(lt, S) {
    this.h.set(S.p(lt, 0, 0, .7))
    const gOut = S.p(lt, 2, 0, .5)
    this.cells.forEach((c, i) => { rise(c, S.p(lt, 0, .5 + i * .35, .5)); if (gOut > 0) op(c, 1 - gOut) })
    pop(this.q1, Math.min(S.p(lt, 1, .3, .6), 1 - gOut)); pop(this.q2, Math.min(S.p(lt, 1, 1.6, .6), 1 - gOut))
    const mOut = S.p(lt, 3, 0, .5)
    const d2 = S.end(2) - S.at(2)
    this.methods.forEach((m, i) => { rise(m, S.p(lt, 2, .4 + i * d2 * .3, .6)); if (mOut > 0) op(m, 1 - mOut) })
    rise(this.ex, S.p(lt, 3, .3, .6))
    const d3 = S.end(3) - S.at(3)
    this.steps.forEach((e, i) => rise(e, S.p(lt, 3, .6 + i * d3 * .28, .5)))
  },
})
