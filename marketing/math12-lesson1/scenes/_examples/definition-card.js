scene('s02', {
  build(root, S) {
    const c = card(root, 'def', 260, 230, 1400)
    this.card = c.el
    this.t1 = rich('المتتاليةُ هي <span class="yel b">تابعٌ</span> مجموعة تعريفه هي مجموعة الأعداد الطبيعيّة $\\mathbb{N}$', 'h3')
    c.body.appendChild(this.t1)
    splitWords(this.t1)
    this.n = tex('(u_n)_{n\\ge 0} \\quad\\text{أو}\\quad (u_n)_{n\\ge n_0}', 'ml')
    root.appendChild(this.n); place(this.n, W / 2, 640, { anchor: 'c' })
    this.hl = hlBox(this.n, root, { pad: 18 })
  },
  render(lt, S) {
    rise(this.card, S.p(lt, 0, 0, .6))
    typeWords(this.t1, S.f(lt, 0, 0, .8))
    wipe(this.n, S.p(lt, 1, .2, 1.2), 'ltr')
    this.hl(S.p(lt, 1, 1.6, .5))
  },
})
